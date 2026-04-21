"""
Agent 工具系统
"""
import json
import re
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import quote, urlparse

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


r"""
Legacy SearchKnowledgeTool implementation disabled due to corrupted encoded string literals.

class SearchKnowledgeTool(BaseTool):
    TECH_TERM_PATTERNS = [
        (re.compile(r"\bjava\b", re.IGNORECASE), "Java"),
        (re.compile(r"\bpython\b", re.IGNORECASE), "Python"),
        (re.compile(r"\bgolang\b|\bgo\b", re.IGNORECASE), "Go"),
        (re.compile(r"\bjavascript\b", re.IGNORECASE), "JavaScript"),
        (re.compile(r"\btypescript\b", re.IGNORECASE), "TypeScript"),
        (re.compile(r"\bspring\s*boot\b", re.IGNORECASE), "Spring Boot"),
        (re.compile(r"\bspring\b", re.IGNORECASE), "Spring"),
        (re.compile(r"\bmysql\b", re.IGNORECASE), "MySQL"),
        (re.compile(r"\bredis\b", re.IGNORECASE), "Redis"),
        (re.compile(r"\bjvm\b", re.IGNORECASE), "JVM"),
    ]
    QUERY_HINT_TERMS = [
        "面试",
        "学习路径",
        "学习路线",
        "学习计划",
        "路线图",
        "roadmap",
        "后端",
        "前端",
        "编程",
        "开发",
        "算法",
        "数据结构",
        "并发",
        "网络",
        "数据库",
        "\u4f8b\u9898",
        "\u771f\u9898",
        "\u9898\u578b",
    ]
    QUERY_EXPANSION_MAP = {
        "Java": ["鍚庣"],
        "Spring Boot": ["Spring"],
        "瀛︿範璺緞": ["瀛︿範璺嚎", "瀛︿範璁″垝", "璺嚎鍥?],
        "瀛︿範璺嚎": ["瀛︿範璺緞", "瀛︿範璁″垝", "璺嚎鍥?],
        "瀛︿範璁″垝": ["瀛︿範璺緞", "瀛︿範璺嚎", "璺嚎鍥?],
        "闈㈣瘯": ["鍩虹", "杩涢樁"],
    }
    QUERY_STOP_TERMS = {
        "帮我",
        "推荐",
        "推荐一个",
        "能够",
        "达到",
        "程度",
        "相关",
        "问题",
        "一下",
        "一下子",
        "这个",
        "那个",
    }

    @classmethod
    def _dedupe_terms(cls, terms: List[str]) -> List[str]:
        deduped = []
        seen = set()
        for term in terms:
            normalized = (term or "").strip()
            if not normalized:
                continue
            key = normalized.lower()
            if key in seen:
                continue
            seen.add(key)
            deduped.append(normalized)
        return deduped

    @classmethod
    def rewrite_query(cls, query: str, grade_level: Optional[str] = None, subject: Optional[str] = None) -> str:
        raw_query = (query or "").strip()
        if not raw_query:
            return ""

        lower_query = raw_query.lower()
        terms: List[str] = []

        for pattern, label in cls.TECH_TERM_PATTERNS:
            if pattern.search(raw_query) or label.lower() in lower_query:
                terms.append(label)

        for keyword in cls.QUERY_HINT_TERMS:
            if keyword.lower() in lower_query or keyword in raw_query:
                terms.append("路线图" if keyword == "roadmap" else keyword)

        if ("学习路径" in terms or "学习路线" in terms or "学习计划" in terms) and "路线图" not in terms:
            terms.append("路线图")

        if grade_level:
            terms.insert(0, grade_level)
        if subject:
            terms.insert(1 if grade_level else 0, subject)

        fallback_terms = re.findall(r"[A-Za-z][A-Za-z0-9.+#-]*|[\u4e00-\u9fff]{2,}", raw_query)
        fallback_terms = [term for term in fallback_terms if term not in cls.QUERY_STOP_TERMS]

        optimized_terms = cls._dedupe_terms(terms or fallback_terms[:6])
        return " ".join(optimized_terms) if optimized_terms else raw_query

    @classmethod
    def build_query_candidates(
        cls,
        query: str,
        grade_level: Optional[str] = None,
        subject: Optional[str] = None,
    ) -> List[str]:
        primary_query = cls.rewrite_query(query, grade_level=grade_level, subject=subject)
        if not primary_query:
            return []

        candidates = [primary_query]
        expanded_terms = primary_query.split()

        for term in list(expanded_terms):
            for extra_term in cls.QUERY_EXPANSION_MAP.get(term, []):
                expanded_terms.append(extra_term)

        expanded_query = " ".join(cls._dedupe_terms(expanded_terms))
        if expanded_query and expanded_query != primary_query:
            candidates.append(expanded_query)

        raw_query = (query or "").strip()
        if raw_query and raw_query not in candidates:
            candidates.append(raw_query)

        return candidates

    @staticmethod
    def _build_result_link(document_id: Optional[int], section_title: Optional[str] = None) -> Optional[str]:
        if not document_id:
            return None
        base_url = f"/knowledge/documents/{document_id}"
        if not section_title:
            return base_url
        return f"{base_url}?section={quote(section_title)}"

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

            raw_query = params["query"]
            query_candidates = self.build_query_candidates(
                raw_query,
                grade_level=params.get("grade_level"),
                subject=params.get("subject"),
            )
            if not query_candidates and raw_query:
                query_candidates = [raw_query]

            results = []
            query_used = query_candidates[0] if query_candidates else raw_query
            for candidate in query_candidates:
                query_used = candidate
                results = RAGService.search(
                    query=candidate,
                    n_results=params.get("limit", 5),
                    grade_level=params.get("grade_level"),
                    subject=params.get("subject"),
                )
                if results:
                    break

            fallback_used = bool(query_candidates) and query_used != query_candidates[0]
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
            default_section_title = "\u77e5\u8bc6\u7247\u6bb5"
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
"""


class SearchKnowledgeTool(BaseTool):
    TECH_TERM_PATTERNS = [
        (re.compile(r"\bjava\b", re.IGNORECASE), "Java"),
        (re.compile(r"\bpython\b", re.IGNORECASE), "Python"),
        (re.compile(r"\bgolang\b|\bgo\b", re.IGNORECASE), "Go"),
        (re.compile(r"\bjavascript\b", re.IGNORECASE), "JavaScript"),
        (re.compile(r"\btypescript\b", re.IGNORECASE), "TypeScript"),
        (re.compile(r"\bspring\s*boot\b", re.IGNORECASE), "Spring Boot"),
        (re.compile(r"\bspring\b", re.IGNORECASE), "Spring"),
        (re.compile(r"\bmysql\b", re.IGNORECASE), "MySQL"),
        (re.compile(r"\bredis\b", re.IGNORECASE), "Redis"),
        (re.compile(r"\bjvm\b", re.IGNORECASE), "JVM"),
    ]
    QUERY_HINT_TERMS = [
        "\u9762\u8bd5",
        "\u5b66\u4e60\u8def\u5f84",
        "\u5b66\u4e60\u8def\u7ebf",
        "\u5b66\u4e60\u8ba1\u5212",
        "\u8def\u7ebf\u56fe",
        "roadmap",
        "\u540e\u7aef",
        "\u524d\u7aef",
        "\u7f16\u7a0b",
        "\u5f00\u53d1",
        "\u7b97\u6cd5",
        "\u6570\u636e\u7ed3\u6784",
        "\u5e76\u53d1",
        "\u7f51\u7edc",
        "\u6570\u636e\u5e93",
        "\u4f8b\u9898",
        "\u771f\u9898",
        "\u9898\u578b",
    ]
    QUERY_EXPANSION_MAP = {
        "Java": ["\u540e\u7aef"],
        "Spring Boot": ["Spring"],
        "\u5b66\u4e60\u8def\u5f84": [
            "\u5b66\u4e60\u8def\u7ebf",
            "\u5b66\u4e60\u8ba1\u5212",
            "\u8def\u7ebf\u56fe",
        ],
        "\u5b66\u4e60\u8def\u7ebf": [
            "\u5b66\u4e60\u8def\u5f84",
            "\u5b66\u4e60\u8ba1\u5212",
            "\u8def\u7ebf\u56fe",
        ],
        "\u5b66\u4e60\u8ba1\u5212": [
            "\u5b66\u4e60\u8def\u5f84",
            "\u5b66\u4e60\u8def\u7ebf",
            "\u8def\u7ebf\u56fe",
        ],
        "\u9762\u8bd5": ["\u57fa\u7840", "\u8fdb\u9636"],
        "\u4f8b\u9898": ["\u771f\u9898", "\u9898\u578b"],
        "\u771f\u9898": ["\u4f8b\u9898", "\u9898\u578b"],
    }
    QUERY_STOP_TERMS = {
        "\u5e2e\u6211",
        "\u63a8\u8350",
        "\u63a8\u8350\u4e00\u4e2a",
        "\u80fd\u591f",
        "\u8fbe\u5230",
        "\u7a0b\u5ea6",
        "\u76f8\u5173",
        "\u95ee\u9898",
        "\u4e00\u4e0b",
        "\u4e00\u4e0b\u5b50",
        "\u8fd9\u4e2a",
        "\u90a3\u4e2a",
    }

    @classmethod
    def _dedupe_terms(cls, terms: List[str]) -> List[str]:
        deduped = []
        seen = set()
        for term in terms:
            normalized = (term or "").strip()
            if not normalized:
                continue
            key = normalized.lower()
            if key in seen:
                continue
            seen.add(key)
            deduped.append(normalized)
        return deduped

    @classmethod
    def rewrite_query(cls, query: str, grade_level: Optional[str] = None, subject: Optional[str] = None) -> str:
        raw_query = (query or "").strip()
        if not raw_query:
            return ""

        lower_query = raw_query.lower()
        terms: List[str] = []

        for pattern, label in cls.TECH_TERM_PATTERNS:
            if pattern.search(raw_query) or label.lower() in lower_query:
                terms.append(label)

        for keyword in cls.QUERY_HINT_TERMS:
            if keyword.lower() in lower_query or keyword in raw_query:
                terms.append("\u8def\u7ebf\u56fe" if keyword == "roadmap" else keyword)

        learning_path_terms = {
            "\u5b66\u4e60\u8def\u5f84",
            "\u5b66\u4e60\u8def\u7ebf",
            "\u5b66\u4e60\u8ba1\u5212",
        }
        if learning_path_terms.intersection(terms) and "\u8def\u7ebf\u56fe" not in terms:
            terms.append("\u8def\u7ebf\u56fe")

        if grade_level:
            terms.insert(0, grade_level)
        if subject:
            terms.insert(1 if grade_level else 0, subject)

        fallback_terms = re.findall(r"[A-Za-z][A-Za-z0-9.+#-]*|[\u4e00-\u9fff]{2,}", raw_query)
        fallback_terms = [term for term in fallback_terms if term not in cls.QUERY_STOP_TERMS]

        optimized_terms = cls._dedupe_terms(terms or fallback_terms[:6])
        return " ".join(optimized_terms) if optimized_terms else raw_query

    @classmethod
    def build_query_candidates(
        cls,
        query: str,
        grade_level: Optional[str] = None,
        subject: Optional[str] = None,
    ) -> List[str]:
        primary_query = cls.rewrite_query(query, grade_level=grade_level, subject=subject)
        if not primary_query:
            return []

        candidates = [primary_query]
        expanded_terms = primary_query.split()

        for term in list(expanded_terms):
            for extra_term in cls.QUERY_EXPANSION_MAP.get(term, []):
                expanded_terms.append(extra_term)

        expanded_query = " ".join(cls._dedupe_terms(expanded_terms))
        if expanded_query and expanded_query != primary_query:
            candidates.append(expanded_query)

        raw_query = (query or "").strip()
        if raw_query and raw_query not in candidates:
            candidates.append(raw_query)

        return candidates

    @staticmethod
    def _build_result_link(document_id: Optional[int], section_title: Optional[str] = None) -> Optional[str]:
        if not document_id:
            return None
        base_url = f"/knowledge/documents/{document_id}"
        if not section_title:
            return base_url
        return f"{base_url}?section={quote(section_title)}"

    def get_definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="search_knowledge",
            description="\u68c0\u7d22\u672c\u5730\u77e5\u8bc6\u5e93\u4e2d\u7684\u77e5\u8bc6\u70b9\u3001\u516c\u5f0f\u3001\u6982\u5ff5\u3001\u8003\u70b9\u4e0e\u8bc1\u636e\u6750\u6599\u3002",
            category="search",
            parameters=[
                ToolParameter(name="query", type="string", description="\u68c0\u7d22\u95ee\u9898\u6216\u5173\u952e\u8bcd"),
                ToolParameter(name="limit", type="integer", description="\u6700\u5927\u8fd4\u56de\u6761\u6570", required=False, default=5),
                ToolParameter(name="grade_level", type="string", description="\u5b66\u6bb5\u8fc7\u6ee4", required=False, default=None),
                ToolParameter(name="subject", type="string", description="\u5b66\u79d1\u8fc7\u6ee4", required=False, default=None),
            ],
            intent_tags=["knowledge_search", "concept", "formula", "exam_point"],
            preconditions=["\u5f53\u7528\u6237\u8be2\u95ee\u6982\u5ff5\u3001\u77e5\u8bc6\u70b9\u3001\u516c\u5f0f\u3001\u8003\u70b9\u65f6\u4f18\u5148\u4f7f\u7528"],
            output_schema={"type": "object", "properties": {"results": {"type": "array"}}},
            quality_checks=["\u4f18\u5148\u547d\u4e2d\u77e5\u8bc6\u5e93\u8bc1\u636e", "\u8fd4\u56de\u6765\u6e90\u6458\u8981"],
            fallback_policy="return_empty_with_warning",
        )

    async def execute(self, db: Session, user_id: int, **kwargs) -> Dict[str, Any]:
        params = self.validate_params(kwargs)
        raw_query = params["query"]
        query_candidates = self.build_query_candidates(
            raw_query,
            grade_level=params.get("grade_level"),
            subject=params.get("subject"),
        )
        if not query_candidates and raw_query:
            query_candidates = [raw_query]

        try:
            from services.rag_service import RAGService

            results = []
            query_used = query_candidates[0] if query_candidates else raw_query
            for candidate in query_candidates:
                query_used = candidate
                results = RAGService.search(
                    query=candidate,
                    n_results=params.get("limit", 5),
                    grade_level=params.get("grade_level"),
                    subject=params.get("subject"),
                )
                if results:
                    break

            fallback_used = bool(query_candidates) and query_used != query_candidates[0]
            if not results:
                return self.build_result(
                    success=True,
                    payload={
                        "query": raw_query,
                        "query_used": query_used,
                        "query_candidates": query_candidates,
                        "results": [],
                        "text": "\u77e5\u8bc6\u5e93\u6682\u65f6\u65e0\u5339\u914d\u8bc1\u636e\u3002",
                    },
                    quality_status="pass",
                    confidence=0.35,
                    fallback_used=fallback_used,
                )

            serialized = []
            evidence = []
            default_section_title = "\u77e5\u8bc6\u7247\u6bb5"
            for item in results:
                result_url = self._build_result_link(item.document_id, item.section_title)
                serialized_item = {
                    "document_id": item.document_id,
                    "chunk_index": item.chunk_index,
                    "title": item.title,
                    "subject": item.subject,
                    "grade_level": item.grade_level,
                    "section_title": item.section_title,
                    "text_preview": item.text[:200],
                    "image_paths": item.image_paths,
                    "url": result_url,
                }
                serialized.append(serialized_item)
                evidence.append(
                    {
                        "type": "knowledge_chunk",
                        "summary": f"{item.title} - {item.section_title or default_section_title}",
                        "excerpt": item.text[:120],
                        "title": item.title,
                        "section_title": item.section_title,
                        "document_id": item.document_id,
                        "chunk_index": item.chunk_index,
                        "url": result_url,
                    }
                )

            return self.build_result(
                success=True,
                payload={
                    "query": raw_query,
                    "query_used": query_used,
                    "query_candidates": query_candidates,
                    "results": serialized,
                    "count": len(serialized),
                    "text": "\n\n".join(item["text_preview"] for item in serialized),
                },
                evidence=evidence,
                confidence=0.88,
                fallback_used=fallback_used,
            )
        except Exception as exc:
            logger.warning("\u77e5\u8bc6\u5e93\u68c0\u7d22\u964d\u7ea7: %s", exc)
            return self.build_result(
                success=True,
                payload={
                    "query": raw_query,
                    "query_used": raw_query,
                    "query_candidates": query_candidates,
                    "results": [],
                    "text": "RAG \u672a\u542f\u7528\uff0c\u5f53\u524d\u65e0\u6cd5\u63d0\u4f9b\u77e5\u8bc6\u5e93\u8bc1\u636e\u3002",
                },
                quality_status="pass",
                confidence=0.25,
                fallback_used=False,
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
    BLOCKED_DOMAINS = {
        "aiqicha.baidu.com",
        "aiqicha.com",
        "www.aiqicha.com",
        "qcc.com",
        "www.qcc.com",
        "tianyancha.com",
        "www.tianyancha.com",
    }
    BLOCKED_TERMS = {
        "爱企查",
        "企业信息查询",
        "企业信用查询",
        "工商查询",
        "老板查询",
        "企查查",
        "天眼查",
    }
    WEB_HINT_PATTERNS = [
        (re.compile(r"\binterview\b|\u9762\u8bd5", re.IGNORECASE), "\u9762\u8bd5"),
        (
            re.compile(
                r"\u5b66\u4e60\u8def\u5f84|\u5b66\u4e60\u8def\u7ebf|\u5b66\u4e60\u8ba1\u5212|\u8def\u7ebf\u56fe|roadmap",
                re.IGNORECASE,
            ),
            "\u5b66\u4e60\u8def\u5f84",
        ),
        (
            re.compile(
                r"\u5b66\u4e60\u8def\u5f84|\u5b66\u4e60\u8def\u7ebf|\u5b66\u4e60\u8ba1\u5212|\u8def\u7ebf\u56fe|roadmap",
                re.IGNORECASE,
            ),
            "\u8def\u7ebf\u56fe",
        ),
        (re.compile(r"\bbackend\b|\u540e\u7aef", re.IGNORECASE), "\u540e\u7aef"),
        (re.compile(r"\bfrontend\b|\u524d\u7aef", re.IGNORECASE), "\u524d\u7aef"),
    ]
    LEARNING_QUERY_PATTERN = re.compile(
        r"\u9762\u8bd5|\u5b66\u4e60\u8def\u5f84|\u5b66\u4e60\u8def\u7ebf|\u5b66\u4e60\u8ba1\u5212|\u8def\u7ebf\u56fe|roadmap|tutorial|guide|interview",
        re.IGNORECASE,
    )
    LEARNING_RESULT_PATTERN = re.compile(
        r"\u5b66\u4e60|\u8def\u5f84|\u8def\u7ebf|\u8ba1\u5212|\u6559\u7a0b|\u9762\u8bd5|roadmap|tutorial|guide|interview|curriculum|path",
        re.IGNORECASE,
    )

    @classmethod
    def _build_keyword_query(cls, query: str) -> str:
        raw_query = (query or "").strip()
        if not raw_query:
            return ""

        lower_query = raw_query.lower()
        terms: List[str] = []

        for pattern, label in SearchKnowledgeTool.TECH_TERM_PATTERNS:
            if pattern.search(raw_query) or label.lower() in lower_query:
                terms.append(label)

        for pattern, label in cls.WEB_HINT_PATTERNS:
            if pattern.search(raw_query):
                terms.append(label)

        fallback_terms = re.findall(r"[A-Za-z][A-Za-z0-9.+#-]*", raw_query)
        optimized_terms = SearchKnowledgeTool._dedupe_terms(terms or fallback_terms[:4])
        return " ".join(optimized_terms)

    @classmethod
    def _build_query_candidates(cls, query: str) -> List[str]:
        candidates: List[str] = []
        keyword_query = cls._build_keyword_query(query)
        if keyword_query:
            candidates.append(keyword_query)

        for candidate in SearchKnowledgeTool.build_query_candidates(query):
            if candidate not in candidates:
                candidates.append(candidate)

        if not candidates and query:
            candidates = [(query or "").strip()]

        web_candidates: List[str] = []
        for candidate in candidates:
            normalized = (candidate or "").strip()
            if not normalized:
                continue
            web_candidates.append(normalized)

            if any(term in normalized for term in ("学习路径", "学习路线", "学习计划", "路线图", "面试")):
                web_candidates.append(f"{normalized} roadmap tutorial")
                web_candidates.append(f"{normalized} 学习资料")

        return SearchKnowledgeTool._dedupe_terms(web_candidates)

    @classmethod
    def _is_noisy_result(cls, title: str, snippet: str, url: str) -> bool:
        domain = urlparse(url or "").netloc.lower()
        if any(domain == blocked or domain.endswith(f".{blocked}") for blocked in cls.BLOCKED_DOMAINS):
            return True

        haystack = f"{title or ''}\n{snippet or ''}\n{url or ''}".lower()
        return any(term.lower() in haystack for term in cls.BLOCKED_TERMS)

    @classmethod
    def _is_low_signal_result(cls, query: str, title: str, snippet: str, url: str) -> bool:
        if not cls.LEARNING_QUERY_PATTERN.search(query or ""):
            return False
        haystack = f"{title or ''}\n{snippet or ''}\n{url or ''}"
        return not bool(cls.LEARNING_RESULT_PATTERN.search(haystack))
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
        raw_query = params["query"]
        query_candidates = self._build_query_candidates(raw_query)
        if not query_candidates and raw_query:
            query_candidates = [raw_query]
        try:
            from ddgs import DDGS

            results = []
            evidence = []
            query_used = raw_query

            for candidate in query_candidates:
                query_used = candidate
                search_results = DDGS().text(candidate, max_results=params.get("max_results", 5))
                candidate_results = []
                candidate_evidence = []
                for item in search_results:
                    result = {
                        "title": item.get("title", ""),
                        "snippet": item.get("body", ""),
                        "url": item.get("href", ""),
                    }
                    if self._is_noisy_result(result["title"], result["snippet"], result["url"]) or self._is_low_signal_result(
                        candidate,
                        result["title"],
                        result["snippet"],
                        result["url"],
                    ):
                        continue
                    candidate_results.append(result)
                    candidate_evidence.append(
                        {
                            "type": "web_result",
                            "title": result["title"],
                            "summary": result["title"],
                            "excerpt": result["snippet"],
                            "url": result["url"],
                        }
                    )

                if candidate_results:
                    results = candidate_results
                    evidence = candidate_evidence
                    break
            fallback_used = bool(query_candidates) and query_used != query_candidates[0]
            if not results:
                return self.build_result(
                    success=True,
                    payload={
                        "query": raw_query,
                        "query_used": query_used,
                        "query_candidates": query_candidates,
                        "results": [],
                        "count": 0,
                        "text": "未找到相关的网页搜索结果。",
                    },
                    quality_status="pass",
                    confidence=0.35,
                    fallback_used=True if query_candidates else fallback_used,
                )

            return self.build_result(
                success=True,
                payload={
                    "query": raw_query,
                    "query_used": query_used,
                    "query_candidates": query_candidates,
                    "results": results,
                    "count": len(results),
                },
                evidence=evidence,
                confidence=0.74,
                fallback_used=fallback_used,
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
    async def execute(self, db: Session, user_id: int, **kwargs) -> Dict[str, Any]:
        params = self.validate_params(kwargs)
        raw_query = params["query"]
        query_candidates = self._build_query_candidates(raw_query)
        if not query_candidates and raw_query:
            query_candidates = [raw_query]

        try:
            from ddgs import DDGS

            results = []
            evidence = []
            query_used = raw_query

            for candidate in query_candidates:
                query_used = candidate
                search_results = DDGS().text(candidate, max_results=params.get("max_results", 5))
                candidate_results = []
                candidate_evidence = []

                for item in search_results:
                    result = {
                        "title": item.get("title", ""),
                        "snippet": item.get("body", ""),
                        "url": item.get("href", ""),
                    }
                    if self._is_noisy_result(result["title"], result["snippet"], result["url"]) or self._is_low_signal_result(
                        candidate,
                        result["title"],
                        result["snippet"],
                        result["url"],
                    ):
                        continue
                    candidate_results.append(result)
                    candidate_evidence.append(
                        {
                            "type": "web_result",
                            "title": result["title"],
                            "summary": result["title"],
                            "excerpt": result["snippet"],
                            "url": result["url"],
                        }
                    )

                if candidate_results:
                    results = candidate_results
                    evidence = candidate_evidence
                    break

            fallback_used = bool(query_candidates) and query_used != query_candidates[0]
            if not results:
                return self.build_result(
                    success=True,
                    payload={
                        "query": raw_query,
                        "query_used": query_used,
                        "query_candidates": query_candidates,
                        "results": [],
                        "count": 0,
                        "text": "未找到相关的网页搜索结果。",
                    },
                    quality_status="pass",
                    confidence=0.35,
                    fallback_used=True if query_candidates else fallback_used,
                )

            return self.build_result(
                success=True,
                payload={
                    "query": raw_query,
                    "query_used": query_used,
                    "query_candidates": query_candidates,
                    "results": results,
                    "count": len(results),
                },
                evidence=evidence,
                confidence=0.74,
                fallback_used=fallback_used,
            )
        except Exception as exc:
            logger.warning("网络搜索降级: %s", exc)
            return self.build_result(
                success=True,
                payload={
                    "query": raw_query,
                    "query_used": raw_query,
                    "query_candidates": query_candidates,
                    "results": [],
                    "count": 0,
                    "text": "网络搜索暂不可用。",
                },
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
