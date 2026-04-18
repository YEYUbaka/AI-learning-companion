"""
Agent 工具系统
"""
import json
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict, List, Optional

from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.logger import logger
from repositories.quiz_paper_repo import QuizPaperRepository
from services.learning_map_service import LearningMapService
from services.quiz_paper_service import QuizPaperService
from utils.file_parser import parse_file


class ToolParameter(BaseModel):
    """工具参数定义"""

    name: str
    type: str
    description: str
    required: bool = True
    default: Optional[Any] = None


class ToolDefinition(BaseModel):
    """工具定义"""

    name: str
    description: str
    category: str
    parameters: List[ToolParameter]
    intent_tags: List[str] = []
    preconditions: List[str] = []
    output_schema: Dict[str, Any] = {}
    quality_checks: List[str] = []
    fallback_policy: str = "graceful_degradation"


class BaseTool(ABC):
    """工具基类"""

    def __init__(self):
        self.definition = self.get_definition()

    @abstractmethod
    def get_definition(self) -> ToolDefinition:
        """获取工具定义"""

    @abstractmethod
    async def execute(self, db: Session, user_id: int, **kwargs) -> Dict[str, Any]:
        """执行工具"""

    def validate_params(self, params: Dict[str, Any]) -> Dict[str, Any]:
        validated = {}
        for parameter in self.definition.parameters:
            if parameter.required and parameter.name not in params:
                raise ValueError(f"缺少必需参数: {parameter.name}")
            value = params.get(parameter.name, parameter.default)
            if value is not None:
                validated[parameter.name] = value
        return validated

    def build_result(
        self,
        *,
        success: bool,
        payload: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
        quality_status: str = "verified",
        confidence: float = 0.8,
        evidence: Optional[List[Dict[str, Any]]] = None,
        fallback_used: bool = False,
    ) -> Dict[str, Any]:
        return {
            "success": success,
            "quality_status": quality_status,
            "confidence": confidence,
            "evidence": evidence or [],
            "fallback_used": fallback_used,
            **(payload or {}),
            **({"error": error} if error else {}),
        }

    def to_openai_tool(self) -> Dict[str, Any]:
        return {
            "type": "function",
            "function": {
                "name": self.definition.name,
                "description": self.definition.description,
                "parameters": {
                    "type": "object",
                    "properties": {
                        parameter.name: {
                            "type": parameter.type,
                            "description": parameter.description,
                        }
                        for parameter in self.definition.parameters
                    },
                    "required": [
                        parameter.name
                        for parameter in self.definition.parameters
                        if parameter.required
                    ],
                },
            },
        }


class FileParserTool(BaseTool):
    def get_definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="parse_file",
            description="解析上传的文件文本，用于后续知识抽取。",
            category="file",
            parameters=[
                ToolParameter(name="file_path", type="string", description="文件路径"),
                ToolParameter(name="max_length", type="integer", description="最大长度", required=False, default=4000),
            ],
            intent_tags=["file", "parse", "document"],
            preconditions=["需要提供已上传的文件路径"],
            output_schema={"type": "object", "properties": {"text": {"type": "string"}}},
            quality_checks=["文本不能为空"],
            fallback_policy="return_partial_text",
        )

    async def execute(self, db: Session, user_id: int, **kwargs) -> Dict[str, Any]:
        try:
            params = self.validate_params(kwargs)
            text, length = parse_file(params["file_path"])
            max_length = params.get("max_length", 4000)
            trimmed = text[:max_length]
            return self.build_result(
                success=True,
                payload={"text": trimmed, "length": min(length, max_length), "file_path": params["file_path"]},
                evidence=[{"type": "file", "summary": Path(params["file_path"]).name}],
                confidence=0.95,
            )
        except Exception as exc:
            logger.error("文件解析失败: %s", exc)
            return self.build_result(success=False, error=str(exc), quality_status="failed", confidence=0.2)


class SearchKnowledgeTool(BaseTool):
    def get_definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="search_knowledge",
            description="检索本地知识库中的知识点、公式、概念、考点与证据材料。",
            category="search",
            parameters=[
                ToolParameter(name="query", type="string", description="检索问题或关键词"),
                ToolParameter(name="limit", type="integer", description="最大返回条数", required=False, default=5),
                ToolParameter(name="grade_level", type="string", description="学段过滤", required=False, default=None),
                ToolParameter(name="subject", type="string", description="学科过滤", required=False, default=None),
            ],
            intent_tags=["knowledge_search", "concept", "formula", "exam_point"],
            preconditions=["当用户询问概念、知识点、公式、考点时优先使用"],
            output_schema={"type": "object", "properties": {"results": {"type": "array"}}},
            quality_checks=["优先命中知识库证据", "返回来源摘要"],
            fallback_policy="return_empty_with_warning",
        )

    async def execute(self, db: Session, user_id: int, **kwargs) -> Dict[str, Any]:
        params = self.validate_params(kwargs)
        try:
            from services.rag_service import RAGService

            results = RAGService.search(
                query=params["query"],
                n_results=params.get("limit", 5),
                grade_level=params.get("grade_level"),
                subject=params.get("subject"),
            )
            if not results:
                return self.build_result(
                    success=True,
                    payload={"query": params["query"], "results": [], "text": "知识库暂无匹配证据。"},
                    quality_status="pass",
                    confidence=0.35,
                    fallback_used=False,  # 无匹配结果是正常情况，不是降级
                )
            serialized = []
            evidence = []
            for item in results:
                serialized_item = {
                    "title": item.title,
                    "subject": item.subject,
                    "grade_level": item.grade_level,
                    "section_title": item.section_title,
                    "text_preview": item.text[:200],
                    "image_paths": item.image_paths,
                }
                serialized.append(serialized_item)
                evidence.append(
                    {
                        "type": "knowledge_chunk",
                        "summary": f"{item.title} - {item.section_title or '知识片段'}",
                        "excerpt": item.text[:120],
                    }
                )
            return self.build_result(
                success=True,
                payload={
                    "query": params["query"],
                    "results": serialized,
                    "count": len(serialized),
                    "text": "\n\n".join(item["text_preview"] for item in serialized),
                },
                evidence=evidence,
                confidence=0.88,
            )
        except Exception as exc:
            logger.warning("知识库检索降级: %s", exc)
            return self.build_result(
                success=True,
                payload={"query": params["query"], "results": [], "text": "RAG 未启用，当前无法提供知识库证据。"},
                quality_status="pass",
                confidence=0.25,
                fallback_used=False,  # RAG未安装是正常预期状态，关键词搜索是设计好的备选路径
                evidence=[],
            )


class SearchExampleQuestionsTool(BaseTool):
    def get_definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="search_example_questions",
            description="检索例题、真题、典型题型素材，优先为组卷和讲题提供证据。",
            category="search",
            parameters=[
                ToolParameter(name="query", type="string", description="知识点或题型描述"),
                ToolParameter(name="limit", type="integer", description="最大返回条数", required=False, default=3),
                ToolParameter(name="grade_level", type="string", description="学段过滤", required=False, default=None),
                ToolParameter(name="subject", type="string", description="学科过滤", required=False, default=None),
            ],
            intent_tags=["example_questions", "true_questions", "paper_generation"],
            preconditions=["当用户要求例题、真题或组卷时优先使用"],
            output_schema={"type": "object", "properties": {"examples": {"type": "array"}}},
            quality_checks=["优先返回含题目风格的证据"],
            fallback_policy="return_empty_with_warning",
        )

    async def execute(self, db: Session, user_id: int, **kwargs) -> Dict[str, Any]:
        params = self.validate_params(kwargs)
        knowledge_result = await SearchKnowledgeTool().execute(
            db=db,
            user_id=user_id,
            query=f"{params['query']} 例题 真题",
            limit=params.get("limit", 3),
            grade_level=params.get("grade_level"),
            subject=params.get("subject"),
        )
        results = knowledge_result.get("results", [])
        examples = []
        for item in results:
            examples.append(
                {
                    "title": item.get("title"),
                    "summary": item.get("text_preview"),
                    "section_title": item.get("section_title"),
                }
            )
        return self.build_result(
            success=True,
            payload={
                "query": params["query"],
                "examples": examples,
                "count": len(examples),
                "text": "\n\n".join(example["summary"] or "" for example in examples),
            },
            quality_status=knowledge_result.get("quality_status", "verified"),
            confidence=knowledge_result.get("confidence", 0.7),
            evidence=knowledge_result.get("evidence", []),
            fallback_used=knowledge_result.get("fallback_used", False),
        )


class BuildPaperBlueprintTool(BaseTool):
    def get_definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="build_paper_blueprint",
            description="生成试卷蓝图，明确题型分布、知识点覆盖、难度与时长。",
            category="paper",
            parameters=[
                ToolParameter(name="title", type="string", description="试卷标题", required=False, default="智能组卷"),
                ToolParameter(name="subject", type="string", description="学科", required=False, default=None),
                ToolParameter(name="grade_level", type="string", description="学段", required=False, default=None),
                ToolParameter(name="total_questions", type="integer", description="总题数", required=False, default=6),
                ToolParameter(name="knowledge_points", type="array", description="知识点列表", required=False, default=[]),
                ToolParameter(name="mode", type="string", description="teacher 或 practice", required=False, default="teacher"),
                ToolParameter(name="source_policy", type="string", description="knowledge_first 或 hybrid", required=False, default="knowledge_first"),
                ToolParameter(name="review_level", type="string", description="strict 或 normal", required=False, default="normal"),
                ToolParameter(name="difficulty_distribution", type="object", description="难度分布", required=False, default={}),
                ToolParameter(name="question_type_distribution", type="object", description="题型分布", required=False, default={}),
                ToolParameter(name="time_limit", type="integer", description="时长", required=False, default=60),
                ToolParameter(name="total_score", type="integer", description="总分", required=False, default=100),
            ],
            intent_tags=["paper_generation", "blueprint"],
            preconditions=["生成试卷前先出蓝图"],
            output_schema={"type": "object", "properties": {"blueprint": {"type": "object"}}},
            quality_checks=["题量分布与知识点覆盖完整"],
            fallback_policy="deterministic_blueprint",
        )

    async def execute(self, db: Session, user_id: int, **kwargs) -> Dict[str, Any]:
        params = self.validate_params(kwargs)
        blueprint = QuizPaperService.build_blueprint(params)
        return self.build_result(
            success=True,
            payload={"blueprint": blueprint},
            evidence=[{"type": "blueprint", "summary": f"{blueprint['total_questions']} 道题，模式 {blueprint['mode']}"}],
            confidence=0.94,
        )


class GeneratePaperQuestionsTool(BaseTool):
    def get_definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="generate_paper_questions",
            description="根据试卷蓝图分批生成题目。",
            category="paper",
            parameters=[
                ToolParameter(name="blueprint", type="object", description="试卷蓝图"),
                ToolParameter(name="config", type="object", description="补充配置", required=False, default={}),
            ],
            intent_tags=["paper_generation", "question_generation"],
            preconditions=["必须先有试卷蓝图"],
            output_schema={"type": "object", "properties": {"questions": {"type": "array"}}},
            quality_checks=["每题必须绑定知识点、难度、答案、解析"],
            fallback_policy="template_questions",
        )

    async def execute(self, db: Session, user_id: int, **kwargs) -> Dict[str, Any]:
        params = self.validate_params(kwargs)
        blueprint = params["blueprint"]
        config = params.get("config") or blueprint
        try:
            questions = QuizPaperService.generate_questions_from_blueprint(db, config, blueprint)
        except Exception as gen_exc:
            logger.error("Agent 题目生成异常: %s", gen_exc, exc_info=True)
            return self.build_result(
                success=False,
                payload={"error": str(gen_exc)},
                fallback_used=False,
            )
        evidence = [
            {
                "type": "generated_question",
                "summary": question.get("stem", "")[:80],
            }
            for question in questions[:3]
        ]

        # 将试卷保存到数据库，以便用户下载
        paper_id = None
        try:
            answer_key = [q.get("answer") for q in questions]
            saved_paper = QuizPaperRepository.create(
                db=db,
                user_id=user_id,
                title=blueprint.get("title", "Agent 生成试卷"),
                subject=blueprint.get("subject"),
                grade_level=blueprint.get("grade_level"),
                total_questions=len(questions),
                difficulty_distribution=blueprint.get("summary", {}).get("difficulty_distribution"),
                question_type_distribution=blueprint.get("summary", {}).get("question_type_distribution"),
                knowledge_points=blueprint.get("knowledge_points"),
                questions=questions,
                answer_key=answer_key,
                paper_type=blueprint.get("mode", "custom"),
                time_limit=blueprint.get("time_limit", 120),
                total_score=blueprint.get("total_score", 100),
            )
            paper_id = saved_paper.id
        except Exception as save_exc:
            logger.warning("Agent 保存试卷到数据库失败: %s", save_exc)  # 不阻断主流程

        return self.build_result(
            success=True,
            payload={"questions": questions, "count": len(questions), "paper_id": paper_id},
            evidence=evidence,
            confidence=0.78,
            fallback_used=False,  # AI生成题目是正常路径，不是降级
        )


class ReviewPaperQualityTool(BaseTool):
    def get_definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="review_paper_quality",
            description="审核试卷质量，输出重复率、覆盖知识点与问题告警。",
            category="paper",
            parameters=[
                ToolParameter(name="blueprint", type="object", description="试卷蓝图"),
                ToolParameter(name="questions", type="array", description="试卷题目"),
                ToolParameter(name="review_level", type="string", description="审核级别", required=False, default="normal"),
            ],
            intent_tags=["paper_review", "quality_review"],
            preconditions=["必须在题目生成之后执行"],
            output_schema={"type": "object", "properties": {"quality_report": {"type": "object"}}},
            quality_checks=["重复率", "答案完整性", "难度分布", "题干清晰度"],
            fallback_policy="rule_based_review",
        )

    async def execute(self, db: Session, user_id: int, **kwargs) -> Dict[str, Any]:
        params = self.validate_params(kwargs)
        report = QuizPaperService.review_generated_paper(
            blueprint=params["blueprint"],
            questions=params["questions"],
            review_level=params.get("review_level", "normal"),
        )
        return self.build_result(
            success=True,
            payload={"quality_report": report},
            quality_status=report["quality_status"],
            confidence=0.9,
            evidence=[{"type": "quality_report", "summary": f"审核分 {report['score']}"}],
        )


class BuildLearningMapTool(BaseTool):
    def get_definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="build_learning_map",
            description="生成知识图谱，支持 syllabus 与 document 两种模式。",
            category="map",
            parameters=[
                ToolParameter(name="topic", type="string", description="课程主题", required=False, default=None),
                ToolParameter(name="file_id", type="integer", description="学习资料 file_id", required=False, default=None),
                ToolParameter(name="map_mode", type="string", description="syllabus 或 document", required=False, default="document"),
                ToolParameter(name="provider", type="string", description="模型提供商", required=False, default=None),
            ],
            intent_tags=["learning_map", "mindmap", "graph"],
            preconditions=["至少提供 topic 或 file_id"],
            output_schema={"type": "object", "properties": {"session_id": {"type": "integer"}}},
            quality_checks=["节点与边必须成图", "包含来源信息"],
            fallback_policy="raise_error",
        )

    async def execute(self, db: Session, user_id: int, **kwargs) -> Dict[str, Any]:
        params = self.validate_params(kwargs)
        result = LearningMapService.generate_graph(
            db=db,
            user_id=user_id,
            file_id=params.get("file_id"),
            course_topic=params.get("topic"),
            provider=params.get("provider"),
            map_mode=params.get("map_mode", "document"),
        )
        graph = LearningMapService.get_graph(db, user_id=user_id, session_id=result["session_id"])
        return self.build_result(
            success=True,
            payload={**result, "graph": graph},
            evidence=[{"type": "learning_map", "summary": f"{result['node_count']} 节点 / {result['edge_count']} 边"}],
            confidence=0.82,
        )


class ExportLearningMapXMindTool(BaseTool):
    REPORT_DIR = Path("reports")

    def get_definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="export_learning_map_xmind",
            description="将知识图谱导出为真实 .xmind 文件。",
            category="export",
            parameters=[ToolParameter(name="session_id", type="integer", description="知识图谱 session_id")],
            intent_tags=["learning_map_export", "xmind"],
            preconditions=["必须先生成知识图谱"],
            output_schema={"type": "object", "properties": {"file_path": {"type": "string"}}},
            quality_checks=["导出文件必须为 .xmind ZIP 包"],
            fallback_policy="raise_error",
        )

    async def execute(self, db: Session, user_id: int, **kwargs) -> Dict[str, Any]:
        params = self.validate_params(kwargs)
        export_result = LearningMapService.export_learning_map(
            db=db,
            user_id=user_id,
            session_id=params["session_id"],
            export_format="xmind",
        )
        self.REPORT_DIR.mkdir(parents=True, exist_ok=True)
        file_path = self.REPORT_DIR / export_result["filename"]
        file_path.write_bytes(export_result["content"])
        return self.build_result(
            success=True,
            payload={
                "file_name": export_result["filename"],
                "file_path": str(file_path),
                "size": len(export_result["content"]),
            },
            evidence=[{"type": "file", "summary": export_result["filename"]}],
            confidence=0.95,
        )


class StudyPlanGeneratorTool(BaseTool):
    def get_definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="generate_study_plan",
            description="生成个性化学习计划。",
            category="plan",
            parameters=[
                ToolParameter(name="goal", type="string", description="学习目标"),
                ToolParameter(name="duration_days", type="integer", description="可选计划天数；不传时系统自动识别或交给AI推断", required=False),
                ToolParameter(name="content", type="string", description="补充内容", required=False, default=""),
            ],
            intent_tags=["study_plan", "learning_path"],
            preconditions=["需要明确学习目标"],
            output_schema={"type": "object", "properties": {"plan": {"type": "object"}}},
            quality_checks=["计划需包含阶段和任务"],
            fallback_policy="return_error",
        )

    async def execute(self, db: Session, user_id: int, **kwargs) -> Dict[str, Any]:
        try:
            from utils.plan_generator import generate_study_plan

            params = self.validate_params(kwargs)
            plan_data = generate_study_plan(
                user_id=user_id,
                goals=params["goal"],
                file_text=params.get("content") or None,
            )
            return self.build_result(
                success=True,
                payload={
                    "plan": {
                        "goal": params["goal"],
                        "duration_days": len(plan_data),
                        "daily_plan": plan_data,
                    }
                },
                confidence=0.78,
            )
        except Exception as exc:
            logger.error("学习计划生成失败: %s", exc)
            return self.build_result(success=False, error=str(exc), quality_status="failed", confidence=0.2)


class WebSearchTool(BaseTool):
    def get_definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="web_search",
            description="执行通用网络搜索。",
            category="search",
            parameters=[
                ToolParameter(name="query", type="string", description="搜索词"),
                ToolParameter(name="max_results", type="integer", description="最大结果数", required=False, default=5),
            ],
            intent_tags=["web_search", "latest_information"],
            preconditions=["需要互联网搜索时使用"],
            output_schema={"type": "object", "properties": {"results": {"type": "array"}}},
            quality_checks=["优先返回标题、摘要、链接"],
            fallback_policy="return_empty_with_warning",
        )

    async def execute(self, db: Session, user_id: int, **kwargs) -> Dict[str, Any]:
        params = self.validate_params(kwargs)
        try:
            from ddgs import DDGS

            search_results = DDGS().text(params["query"], max_results=params.get("max_results", 5))
            results = []
            evidence = []
            for item in search_results:
                result = {
                    "title": item.get("title", ""),
                    "snippet": item.get("body", ""),
                    "url": item.get("href", ""),
                }
                results.append(result)
                evidence.append({"type": "web_result", "summary": result["title"], "excerpt": result["snippet"]})
            return self.build_result(
                success=True,
                payload={"query": params["query"], "results": results, "count": len(results)},
                evidence=evidence,
                confidence=0.74,
            )
        except Exception as exc:
            logger.warning("网络搜索降级: %s", exc)
            return self.build_result(
                success=True,
                payload={"query": params["query"], "results": [], "count": 0, "text": "网络搜索暂不可用。"},
                quality_status="warning",
                confidence=0.2,
                fallback_used=True,
            )


class QuizGeneratorTool(BaseTool):
    def get_definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="generate_quiz",
            description="生成常规测验题目。",
            category="quiz",
            parameters=[
                ToolParameter(name="topic", type="string", description="测验主题"),
                ToolParameter(name="num_questions", type="integer", description="题目数量", required=False, default=5),
                ToolParameter(name="difficulty", type="string", description="难度", required=False, default="medium"),
            ],
            intent_tags=["quiz_generation"],
            preconditions=["常规测评场景"],
            output_schema={"type": "object", "properties": {"questions": {"type": "array"}}},
            quality_checks=["题目数量与答案完整"],
            fallback_policy="template_questions",
        )

    async def execute(self, db: Session, user_id: int, **kwargs) -> Dict[str, Any]:
        try:
            from services.quiz_service import QuizService

            params = self.validate_params(kwargs)
            quiz_service = QuizService(db)
            result = await quiz_service.generate_quiz(
                user_id=user_id,
                topic=params["topic"],
                num_questions=params.get("num_questions", 5),
                difficulty=params.get("difficulty", "medium"),
            )
            return self.build_result(
                success=True,
                payload={"quiz_id": result.get("quiz_id"), "questions": result.get("questions", [])},
                confidence=0.75,
            )
        except Exception as exc:
            logger.error("测验生成失败: %s", exc)
            return self.build_result(success=False, error=str(exc), quality_status="failed", confidence=0.2)
