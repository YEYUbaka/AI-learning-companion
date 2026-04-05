"""
Agent 工具系统 - 工具基类和具体实现
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
import time
from utils.file_parser import parse_file
from services.quiz_service import QuizService
from services.learning_map_service import LearningMapService
from core.logger import logger


class ToolParameter(BaseModel):
    """工具参数定义"""
    name: str
    type: str  # string, integer, boolean, array, object
    description: str
    required: bool = True
    default: Optional[Any] = None


class ToolDefinition(BaseModel):
    """工具定义"""
    name: str
    description: str
    category: str  # file, quiz, map, plan, export
    parameters: List[ToolParameter]


class BaseTool(ABC):
    """工具基类"""

    def __init__(self):
        self.name = self.__class__.__name__.replace("Tool", "").lower()
        self.definition = self.get_definition()

    @abstractmethod
    def get_definition(self) -> ToolDefinition:
        """获取工具定义"""
        pass

    @abstractmethod
    async def execute(self, db: Session, user_id: int, **kwargs) -> Dict[str, Any]:
        """执行工具"""
        pass

    def validate_params(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """校验参数"""
        validated = {}
        for param in self.definition.parameters:
            if param.required and param.name not in params:
                raise ValueError(f"缺少必需参数: {param.name}")

            value = params.get(param.name, param.default)
            if value is not None:
                validated[param.name] = value

        return validated


class FileParserTool(BaseTool):
    """文件解析工具"""

    def get_definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="parse_file",
            description="解析上传的文档文件（PDF/DOCX/PPTX/TXT），提取文本内容",
            category="file",
            parameters=[
                ToolParameter(
                    name="file_path",
                    type="string",
                    description="文件路径（相对于上传目录）",
                    required=True
                ),
                ToolParameter(
                    name="max_length",
                    type="integer",
                    description="最大字符数（默认 12000）",
                    required=False,
                    default=12000
                )
            ]
        )

    async def execute(self, db: Session, user_id: int, **kwargs) -> Dict[str, Any]:
        """执行文件解析"""
        try:
            params = self.validate_params(kwargs)
            file_path = params["file_path"]
            max_length = params.get("max_length", 12000)
              # 调用现有的文件解析函数
            text = parse_file(file_path)

            # 截断过长文本
            if len(text) > max_length:
                text = text[:max_length] + "\n...(内容已截断)"

            return {
                "success": True,
                "text": text,
                "length": len(text),
                "file_path": file_path
            }
        except Exception as e:
            logger.error(f"文件解析失败: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }


class QuizGeneratorTool(BaseTool):
    """智能组卷工具"""

    def get_definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="generate_quiz",
            description="根据主题和难度生成测验题目",
            category="quiz",
            parameters=[
                ToolParameter(
                    name="topic",
                    type="string",
                    description="测验主题或学习内容",
                    required=True
                ),
                ToolParameter(
                    name="num_questions",
                    type="integer",
                    description="题目数量（默认 5）",
                    required=False,
                    default=5
                ),
                ToolParameter(
                    name="difficulty",
                    type="string",
                    description="难度等级：easy, medium, hard（默认 medium）",
                    required=False,
                    default="medium"
                )
            ]
        )

    async def execute(self, db: Session, user_id: int, **kwargs) -> Dict[str, Any]:
        """执行智能组卷"""
        try:
            params = self.validate_params(kwargs)

            quiz_service = QuizService(db)
            result = await quiz_service.generate_quiz(
                user_id=user_id,
                topic=params["topic"],
                num_questions=params.get("num_questions", 5),
                difficulty=params.get("difficulty", "medium")
            )

            return {
                "success": True,
                "quiz_id": result.get("quiz_id"),
                "questions": result.get("questions"),
                "topic": params["topic"]
            }
        except Exception as e:
            logger.error(f"智能组卷失败: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }


class LearningMapBuilderTool(BaseTool):
    """知识图谱构建工具"""

    def get_definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="build_learning_map",
            description="根据学习主题构建知识图谱",
            category="map",
            parameters=[
                ToolParameter(
                    name="topic",
                    type="string",
                    description="学习主题或课程名称（如：Java异步编程、Python数据分析）",
                    required=True
                )
            ]
        )

    async def execute(self, db: Session, user_id: int, **kwargs) -> Dict[str, Any]:
        """执行知识图谱构建"""
        try:
            params = self.validate_params(kwargs)
            topic = params.get("topic", "")

            if not topic:
                return {
                    "success": False,
                    "error": "请提供学习主题"
                }

            # 调用 generate_graph 生成图谱
            result = LearningMapService.generate_graph(
                db=db,
                user_id=user_id,
                file_id=None,
                course_topic=topic,
                provider=None
            )

            # generate_graph 返回的是 session_id，需要再获取图谱数据
            if result.get("success") and result.get("session_id"):
                session_id = result["session_id"]

                # 获取完整的图谱数据
                graph_data = LearningMapService.get_graph(db, session_id, user_id)

                if graph_data:
                    return {
                        "success": True,
                        "session_id": session_id,
                        "node_count": result.get("node_count", 0),
                        "edge_count": result.get("edge_count", 0),
                        "nodes": graph_data.get("nodes", []),
                        "edges": graph_data.get("edges", []),
                        "message": f"成功生成知识图谱，包含 {result.get('node_count', 0)} 个知识点"
                    }

            return {
                "success": False,
                "error": "知识图谱生成失败"
            }

        except Exception as e:
            logger.error(f"知识图谱构建失败: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }


class StudyPlanGeneratorTool(BaseTool):
    """学习计划生成工具"""

    def get_definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="generate_study_plan",
            description="生成个性化学习计划",
            category="plan",
            parameters=[
                ToolParameter(
                    name="goal",
                    type="string",
                    description="学习目标",
                    required=True
                ),
                ToolParameter(
                    name="duration_days",
                    type="integer",
                    description="计划天数（默认 30）",
                    required=False,
                    default=30
                ),
                ToolParameter(
                    name="content",
                    type="string",
                    description="学习内容或参考资料",
                    required=False,
                    default=""
                )
            ]
        )

    async def execute(self, db: Session, user_id: int, **kwargs) -> Dict[str, Any]:
        """执行学习计划生成"""
        try:
            params = self.validate_params(kwargs)

            # 调用真实的学习计划生成服务
            from utils.plan_generator import generate_study_plan

            # 构建学习目标描述
            goal = params["goal"]
            duration_days = params.get("duration_days", 30)
            content = params.get("content", "")

            # 组合目标描述
            full_goal = f"{goal}（计划 {duration_days} 天）"

            # 调用生成器
            plan_data = generate_study_plan(
                user_id=user_id,
                goals=full_goal,
                file_text=content if content else None
            )

            # 转换为更详细的格式
            plan = {
                "goal": goal,
                "duration_days": duration_days,
                "daily_plan": plan_data,
                "total_days": len(plan_data)
            }

            return {
                "success": True,
                "plan": plan
            }
        except Exception as e:
            logger.error(f"学习计划生成失败: {str(e)}")
            return {
                "success": False,
                "error": "学习计划生成失败，请检查 AI 模型配置是否正确，或稍后重试"
            }


class WebSearchTool(BaseTool):
    """网络搜索工具"""

    def get_definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="web_search",
            description="在互联网上搜索信息，获取最新的知识和资料",
            category="search",
            parameters=[
                ToolParameter(
                    name="query",
                    type="string",
                    description="搜索关键词或问题",
                    required=True
                ),
                ToolParameter(
                    name="max_results",
                    type="integer",
                    description="最大返回结果数（默认 5）",
                    required=False,
                    default=5
                )
            ]
        )

    async def execute(self, db: Session, user_id: int, **kwargs) -> Dict[str, Any]:
        """执行网络搜索"""
        try:
            params = self.validate_params(kwargs)
            query = params["query"]
            max_results = params.get("max_results", 5)

            # 使用 DuckDuckGo 搜索（无需 API 密钥）
            try:
                from ddgs import DDGS

                results = []
                ddgs = DDGS()
                search_results = ddgs.text(query, max_results=max_results)
                for r in search_results:
                    results.append({
                        "title": r.get("title", ""),
                        "snippet": r.get("body", ""),
                        "url": r.get("href", "")
                    })

                if not results:
                    return {
                        "success": False,
                        "error": "未找到相关结果"
                    }

                # 格式化搜索结果（使用 Markdown 链接格式）
                formatted_results = "\n\n".join([
                    f"**{i+1}. [{r['title']}]({r['url']})**\n\n{r['snippet']}\n\n[点击访问原文]({r['url']})"
                    for i, r in enumerate(results)
                ])

                return {
                    "success": True,
                    "query": query,
                    "results": results,
                    "text": formatted_results,
                    "count": len(results)
                }
            except ImportError:
                # 如果没有安装 duckduckgo_search，返回提示
                logger.warning("duckduckgo_search 未安装，使用模拟搜索")
                return {
                    "success": True,
                    "query": query,
                    "text": f"搜索关键词：{query}\n\n提示：网络搜索功能需要安装 duckduckgo-search 库。\n请运行: pip install duckduckgo-search",
                    "count": 0
                }
            except Exception as search_err:
                # 搜索服务本身出错（网络问题、API 限制等）
                logger.warning(f"网络搜索服务异常: {str(search_err)}")
                return {
                    "success": True,
                    "query": query,
                    "text": f"关于「{query}」的搜索暂时无法完成（网络服务暂时不可用），但我可以根据已有知识为你提供一些参考信息。",
                    "count": 0
                }
        except Exception as e:
            logger.error(f"网络搜索失败: {str(e)}")
            return {
                "success": False,
                "error": "搜索服务暂时不可用，请稍后重试"
            }


class KnowledgeSearchTool(BaseTool):
    """本地知识库语义搜索工具（RAG）"""

    def get_definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="search_knowledge",
            description="在本地知识库中语义搜索学科知识、真题、概念解析等。适用：数学公式、物理定律、化学原理、语文知识、历史事件、真题解析、知识点讲解",
            category="search",
            parameters=[
                ToolParameter(
                    name="query",
                    type="string",
                    description="搜索查询（支持自然语言，如：分数加减法如何计算）",
                    required=True
                ),
                ToolParameter(
                    name="limit",
                    type="integer",
                    description="最大返回结果数（默认 5）",
                    required=False,
                    default=5
                ),
                ToolParameter(
                    name="grade_level",
                    type="string",
                    description="年级过滤：小学/初中/高中/大学/通用（可选）",
                    required=False,
                    default=None
                ),
                ToolParameter(
                    name="subject",
                    type="string",
                    description="学科过滤：数学/物理/化学/生物/语文/英语/历史/地理/政治/信息技术（可选）",
                    required=False,
                    default=None
                )
            ]
        )

    async def execute(self, db: Session, user_id: int, **kwargs) -> Dict[str, Any]:
        """执行 RAG 语义检索"""
        try:
            params = self.validate_params(kwargs)
            query = params["query"]
            limit = params.get("limit", 5)
            grade_level = params.get("grade_level")
            subject = params.get("subject")

            from services.rag_service import RAGService

            results = RAGService.search(
                query=query,
                n_results=limit,
                grade_level=grade_level,
                subject=subject
            )

            if not results:
                return {
                    "success": True,
                    "query": query,
                    "text": f"知识库中暂无与「{query}」相关的内容。请尝试换个关键词，或通过管理后台上传相关知识文档。",
                    "count": 0
                }

            # 构建 RAG context
            rag_context = RAGService.build_rag_context(query, results)

            return {
                "success": True,
                "query": query,
                "text": rag_context,
                "count": len(results),
                "results": [
                    {
                        "title": r.title,
                        "grade_level": r.grade_level,
                        "subject": r.subject,
                        "section_title": r.section_title,
                        "text_preview": r.text[:200],
                        "image_paths": r.image_paths
                    }
                    for r in results
                ]
            }
        except Exception as e:
            logger.error(f"知识库搜索失败: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
