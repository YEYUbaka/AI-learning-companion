"""
Agent 执行引擎
"""
import asyncio
import base64
import json
import mimetypes
from pathlib import Path
import re
from typing import Any, AsyncGenerator, Dict, List, Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from core.config import settings
from core.logger import logger
from repositories.agent_repo import AgentRepository
from services.ai_service import AIService
from services.feature_model_config_service import FeatureModelConfigService
from utils.tool_registry import ToolRegistry


EDUCATION_EVIDENCE_KEYWORDS = [
    "知识点",
    "概念",
    "定义",
    "公式",
    "原理",
    "例题",
    "真题",
    "考点",
]

CURRENT_EVENTS_KEYWORDS = [
    "最新",
    "最近",
    "近期",
    "今天",
    "新闻",
    "资讯",
    "动态",
    "热点",
    "趋势",
    "进展",
    "快讯",
    "大事件",
    "重大事件",
    "发生了什么",
]

CURRENT_EVENTS_KEYWORDS_EN = [
    "latest",
    "recent",
    "today",
    "news",
    "update",
    "updates",
    "trend",
    "trends",
    "headline",
    "headlines",
]

SEARCH_INTENT_KEYWORDS = [
    "搜索",
    "查找",
    "搜一下",
    "搜一搜",
    "查一下",
    "帮我找",
    "看看",
]

SEARCH_INTENT_KEYWORDS_EN = [
    "search",
    "find",
    "look up",
]

EXPLICIT_SEARCH_INTENT_KEYWORDS = [
    "搜索",
    "查找",
    "检索",
    "搜一下",
    "搜一搜",
    "帮我找",
    "帮我搜",
    "上网查",
    "联网查",
]

EXPLICIT_SEARCH_INTENT_KEYWORDS_EN = [
    "search",
    "find",
    "look up",
    "google",
]

LEARNING_PATH_KEYWORDS = [
    "学习计划",
    "学习路线",
    "学习路径",
    "路线图",
]

LEARNING_PATH_KEYWORDS_EN = [
    "study plan",
    "learning path",
    "learning roadmap",
    "roadmap",
]

RESOURCE_RECOMMENDATION_KEYWORDS = [
    "推荐",
    "up主",
    "博主",
    "课程",
    "老师",
    "书",
    "教材",
    "视频",
    "资料",
    "资源",
]

RESOURCE_RECOMMENDATION_KEYWORDS_EN = [
    "recommend",
    "recommended",
    "creator",
    "course",
    "courses",
    "book",
    "books",
    "video",
    "videos",
    "resource",
    "resources",
]

FOLLOW_UP_QUERY_KEYWORDS = [
    "详细",
    "展开",
    "继续",
    "具体",
    "分步",
    "一步一步",
    "再讲",
    "细说",
    "解释一下",
    "为什么",
    "怎么得",
    "哪一步",
]

FOLLOW_UP_QUERY_KEYWORDS_EN = [
    "detail",
    "details",
    "elaborate",
    "expand",
    "continue",
    "step by step",
    "explain why",
]

CONTEXT_REFERENCE_KEYWORDS = [
    "它",
    "他",
    "她",
    "它们",
    "这个",
    "这本",
    "这篇",
    "这题",
    "这道题",
    "上述",
    "上面",
    "前面",
    "刚才",
    "这里",
    "其",
]

CONTEXT_REFERENCE_KEYWORDS_EN = [
    "it",
    "this",
    "that",
    "these",
    "those",
    "above",
    "previous",
]

SEARCH_QUERY_PREFIX_PATTERN = re.compile(
    r"^(?:请问|请|麻烦|帮我|帮忙|可以|能否|能不能|给我|我想知道|想知道|告诉我|请你|再帮我|帮我再)\s*",
    re.IGNORECASE,
)

SEARCH_ACTION_PREFIX_PATTERN = re.compile(
    r"^(?:搜索|查找|检索|搜一下|搜一搜|查一下|查一查|search|find|look up|google)\s*",
    re.IGNORECASE,
)

TECH_QUERY_KEYWORDS = [
    "Java",
    "java",
    "Python",
    "python",
    "Go",
    "golang",
    "JavaScript",
    "TypeScript",
    "Spring",
    "Spring Boot",
    "MySQL",
    "Redis",
    "JVM",
    "后端",
    "前端",
    "编程",
    "开发",
    "算法",
    "数据结构",
    "面试",
]

TECH_QUERY_KEYWORDS_EN = [
    "java",
    "python",
    "golang",
    "javascript",
    "typescript",
    "spring",
    "spring boot",
    "mysql",
    "redis",
    "jvm",
    "backend",
    "frontend",
    "programming",
    "coding",
    "interview",
]

META_EVIDENCE_MARKERS = [
    "本地知识库未命中",
    "知识库未命中",
    "知识库暂无匹配",
    "RAG 未启用",
    "网络搜索暂不可用",
]

SEMANTIC_ROUTE_CONFIDENCE_THRESHOLD = 0.7
SEMANTIC_ROUTE_PROMPT_NAME = "agent_semantic_router_prompt"
SEMANTIC_ROUTE_INTENTS = {
    "context_followup",
    "fresh_search",
    "resource_recommendation",
    "knowledge_lookup",
    "study_plan",
    "paper_generation",
    "learning_map",
    "direct_answer",
}


class AgentPlanner:
    """结构化规划器"""

    def __init__(self, tool_registry: ToolRegistry):
        self.tool_registry = tool_registry

    @staticmethod
    def _extract_current_user_message(goal: str) -> str:
        goal_text = (goal or "").strip()
        marker = "当前用户消息："
        if marker in goal_text:
            return goal_text.rsplit(marker, 1)[-1].strip()
        return goal_text

    @staticmethod
    def _extract_context_user_messages(goal: str) -> List[str]:
        goal_text = (goal or "").strip()
        context_marker = "对话上下文："
        current_marker = "当前用户消息："
        if context_marker not in goal_text or current_marker not in goal_text:
            return []

        context_block = goal_text.split(context_marker, 1)[1].split(current_marker, 1)[0]
        messages: List[str] = []
        for raw_line in context_block.splitlines():
            line = raw_line.strip()
            if not line:
                continue
            if line.startswith("用户:") or line.startswith("用户："):
                parts = re.split(r"[:：]", line, maxsplit=1)
                if len(parts) == 2 and parts[1].strip():
                    messages.append(parts[1].strip())
        return messages

    @classmethod
    def _clean_query_text(cls, query: str) -> str:
        normalized = re.sub(r"\s+", " ", (query or "").strip())
        previous = None
        while normalized and normalized != previous:
            previous = normalized
            normalized = SEARCH_QUERY_PREFIX_PATTERN.sub("", normalized).strip()
        return normalized.strip("：:，,。.？?！!；; ")

    @classmethod
    def _strip_search_action_prefix(cls, query: str) -> str:
        normalized = cls._clean_query_text(query)
        previous = None
        while normalized and normalized != previous:
            previous = normalized
            normalized = SEARCH_ACTION_PREFIX_PATTERN.sub("", normalized).strip()
        return normalized

    @staticmethod
    def _contains_any_keyword(
        goal_text: str,
        lower_goal: str,
        chinese_keywords: List[str],
        english_keywords: List[str] = None,
    ) -> bool:
        if any(keyword in goal_text for keyword in chinese_keywords):
            return True
        if english_keywords and any(keyword in lower_goal for keyword in english_keywords):
            return True
        return False

    @classmethod
    def _is_current_events_query(cls, goal_text: str, lower_goal: str) -> bool:
        return cls._contains_any_keyword(
            goal_text,
            lower_goal,
            CURRENT_EVENTS_KEYWORDS,
            CURRENT_EVENTS_KEYWORDS_EN,
        )

    @classmethod
    def _is_explicit_search_request(cls, goal_text: str, lower_goal: str) -> bool:
        return cls._contains_any_keyword(
            goal_text,
            lower_goal,
            EXPLICIT_SEARCH_INTENT_KEYWORDS,
            EXPLICIT_SEARCH_INTENT_KEYWORDS_EN,
        )

    @classmethod
    def _is_search_intent(cls, goal_text: str, lower_goal: str) -> bool:
        return cls._contains_any_keyword(
            goal_text,
            lower_goal,
            SEARCH_INTENT_KEYWORDS,
            SEARCH_INTENT_KEYWORDS_EN,
        ) or cls._is_current_events_query(goal_text, lower_goal)

    @classmethod
    def _is_learning_path_query(cls, goal_text: str, lower_goal: str) -> bool:
        return cls._contains_any_keyword(
            goal_text,
            lower_goal,
            LEARNING_PATH_KEYWORDS,
            LEARNING_PATH_KEYWORDS_EN,
        ) or "怎么学" in goal_text

    @classmethod
    def _is_paper_generation_query(cls, goal_text: str) -> bool:
        text = cls._clean_query_text(goal_text)
        lower_text = text.lower()

        if any(keyword in text for keyword in ["解答", "讲解", "解析", "怎么做", "为什么", "第"]):
            if any(keyword in text for keyword in ["上传", "这份试卷", "试卷中", "试卷里", "这道题", "题目"]):
                return False

        explicit_generation_phrases = [
            "组卷",
            "智能组卷",
            "生成试卷",
            "生成一份试卷",
            "生成一套试卷",
            "生成练习题",
            "生成一套练习题",
            "生成教师卷",
            "生成练习卷",
            "出题",
            "命题",
            "设计试卷",
            "设计练习题",
            "创建试卷",
            "制作试卷",
        ]
        if any(keyword in text for keyword in explicit_generation_phrases):
            return True

        generation_verbs = ["生成", "设计", "创建", "制作", "编写", "拟定"]
        paper_targets = ["试卷", "练习题", "教师卷", "练习卷", "卷子", "测试题", "测验题"]
        if any(verb in text for verb in generation_verbs) and any(target in text for target in paper_targets):
            return True

        if re.search(r"出.{0,4}(一套|一份|一道|几道|[0-9一二三四五六七八九十]+道).{0,8}(题|试卷|练习)", text):
            return True

        return any(
            phrase in lower_text
            for phrase in [
                "generate a test",
                "generate an exam",
                "generate a quiz",
                "create a test paper",
                "create an exam paper",
                "make a worksheet",
            ]
        )

    @classmethod
    def _is_learning_map_query(cls, goal_text: str, lower_goal: str) -> bool:
        return any(keyword in goal_text for keyword in ["知识图谱", "思维导图", "XMind"]) or "xmind" in lower_goal

    @classmethod
    def _is_tech_query(cls, goal_text: str, lower_goal: str) -> bool:
        return cls._contains_any_keyword(
            goal_text,
            lower_goal,
            TECH_QUERY_KEYWORDS,
            TECH_QUERY_KEYWORDS_EN,
        )

    @classmethod
    def _is_tech_learning_query(cls, goal_text: str, lower_goal: str) -> bool:
        return cls._is_tech_query(goal_text, lower_goal) and cls._is_learning_path_query(goal_text, lower_goal)

    @classmethod
    def _is_resource_recommendation_query(cls, goal_text: str, lower_goal: str) -> bool:
        return cls._has_resource_intent(goal_text, lower_goal) and not cls._is_learning_path_query(goal_text, lower_goal)

    @classmethod
    def _has_resource_intent(cls, goal_text: str, lower_goal: str) -> bool:
        return cls._contains_any_keyword(
            goal_text,
            lower_goal,
            RESOURCE_RECOMMENDATION_KEYWORDS,
            RESOURCE_RECOMMENDATION_KEYWORDS_EN,
        )

    @classmethod
    def _is_follow_up_query(cls, goal_text: str, lower_goal: str) -> bool:
        return cls._contains_any_keyword(
            goal_text,
            lower_goal,
            FOLLOW_UP_QUERY_KEYWORDS,
            FOLLOW_UP_QUERY_KEYWORDS_EN,
        )

    @classmethod
    def _has_context_reference(cls, goal_text: str, lower_goal: str) -> bool:
        return cls._contains_any_keyword(
            goal_text,
            lower_goal,
            CONTEXT_REFERENCE_KEYWORDS,
            CONTEXT_REFERENCE_KEYWORDS_EN,
        )

    @classmethod
    def _build_context_aware_query(cls, goal: str) -> str:
        latest_message = cls._strip_search_action_prefix(cls._extract_current_user_message(goal))
        if not latest_message:
            return cls._clean_query_text(goal)

        lower_goal = latest_message.lower()
        prior_user_messages = [
            cleaned
            for cleaned in (cls._clean_query_text(item) for item in cls._extract_context_user_messages(goal))
            if cleaned
        ]
        if prior_user_messages and (
            cls._is_follow_up_query(latest_message, lower_goal)
            or cls._has_context_reference(latest_message, lower_goal)
        ):
            topic_hint = prior_user_messages[-1]
            if topic_hint.lower() not in lower_goal:
                return cls._strip_search_action_prefix(f"{topic_hint} {latest_message}")
        return latest_message

    # ReAct-style planner that maps common intents to deterministic tool chains.
    def plan(self, goal: str) -> Dict[str, Any]:
        # Route high-confidence intents first so required tools are selected
        # deterministically before the downstream agent starts free-form work.
        goal_text = self._clean_query_text(self._extract_current_user_message(goal))
        lower_goal = goal_text.lower()
        retrieval_query = self._build_context_aware_query(goal)
        trace_id = str(uuid4())
        tool_steps: List[Dict[str, Any]] = []
        rationale = "根据用户意图进行结构化工具规划。"
        confidence = 0.76

        if self._is_paper_generation_query(goal_text):
            config = self._extract_paper_config(goal_text)
            tool_steps = [
                {"tool_name": "build_paper_blueprint", "tool_input": config, "reason": "先固定试卷蓝图"},
                {
                    "tool_name": "generate_paper_questions",
                    "tool_input": {"blueprint": "__from_previous__.blueprint", "config": config},
                    "reason": "按蓝图批量出题",
                },
                {
                    "tool_name": "review_paper_quality",
                    "tool_input": {
                        "blueprint": "__from_previous__.blueprint",
                        "questions": "__from_previous__.questions",
                        "review_level": config["review_level"],
                    },
                    "reason": "对题目进行自动审核",
                },
            ]
            rationale = "检测到组卷意图，按照蓝图、生成、审核三阶段执行。"
            confidence = 0.92
        elif self._is_learning_map_query(goal_text, lower_goal):
            map_mode = "syllabus" if any(keyword in goal_text for keyword in ["课程", "章节", "大纲"]) else "document"
            tool_steps = [
                {
                    "tool_name": "build_learning_map",
                    "tool_input": {"topic": goal_text, "map_mode": map_mode},
                    "reason": "先生成学习地图",
                }
            ]
            if "xmind" in lower_goal:
                tool_steps.append(
                    {
                        "tool_name": "export_learning_map_xmind",
                        "tool_input": {"session_id": "__from_previous__.session_id"},
                        "reason": "按请求导出 xmind",
                    }
                )
            rationale = "检测到知识图谱/导图意图，优先生成结构图，再按需导出。"
            confidence = 0.9
        elif self._is_current_events_query(goal_text, lower_goal):
            tool_steps = [
                {
                    "tool_name": "web_search",
                    "tool_input": {"query": retrieval_query, "max_results": 8},
                    "reason": "当前问题涉及近期/最新动态，优先联网搜索。",
                }
            ]
            rationale = "检测到近期/最新资讯类诉求，优先联网搜索，再由 AI 整理为正式回答。"
            confidence = 0.88
        elif self._is_tech_learning_query(goal_text, lower_goal):
            tool_steps = [
                {
                    "tool_name": "search_knowledge",
                    "tool_input": {"query": retrieval_query, "limit": 5},
                    "reason": "先检索技术学习路径相关知识证据，为最终回答补充可点击参考链接",
                },
                {
                    "tool_name": "generate_study_plan",
                    "tool_input": {"goal": goal_text},
                    "reason": "技术学习路径请求直接生成阶段化计划，避免误召回中小学知识库",
                }
            ]
            rationale = "检测到编程/面试类学习路径请求，优先生成学习计划而不是检索 K12 知识库。"
            confidence = 0.86
        elif self._is_resource_recommendation_query(goal_text, lower_goal):
            tool_steps = [
                {
                    "tool_name": "web_search",
                    "tool_input": {"query": retrieval_query, "max_results": 8},
                    "reason": "Use web search for recommendation and resource discovery queries.",
                }
            ]
            rationale = "Resource recommendation requests should prefer fresh external search over weak knowledge-base matches."
            confidence = 0.9
        elif any(keyword in goal_text for keyword in EDUCATION_EVIDENCE_KEYWORDS):
            tool_steps.append(
                {
                    "tool_name": "search_knowledge",
                    "tool_input": {"query": retrieval_query, "limit": 5},
                    "reason": "教育类问答优先检索知识库证据",
                }
            )
            if any(keyword in goal_text for keyword in ["例题", "真题", "题"]):
                tool_steps.append(
                    {
                        "tool_name": "search_example_questions",
                        "tool_input": {"query": retrieval_query, "limit": 3},
                        "reason": "补充例题/真题素材",
                    }
                )
            rationale = "检测到教育类知识问答，先检索知识库，再补充样题证据。"
            confidence = 0.87
        elif any(keyword in goal_text for keyword in ["学习计划", "学习路线", "怎么学"]):
            tool_steps = [
                {
                    "tool_name": "generate_study_plan",
                    "tool_input": {"goal": goal_text},
                    "reason": "根据目标生成学习计划",
                }
            ]
            rationale = "检测到学习计划意图，直接生成学习计划。"
            confidence = 0.82
        elif self._is_explicit_search_request(goal_text, lower_goal):
            tool_steps = [
                {
                    "tool_name": "web_search",
                    "tool_input": {"query": retrieval_query, "max_results": 5},
                    "reason": "需要联网检索最新信息",
                }
            ]
            rationale = "检测到搜索意图，直接使用网络检索。"
            confidence = 0.72
        else:
            tool_steps = [
                {
                    "tool_name": "search_knowledge",
                    "tool_input": {"query": retrieval_query, "limit": 5},
                    "reason": "默认先尝试知识库检索，再组织回答。",
                }
            ]
            rationale = "未命中特殊流程，先走知识检索保障回答质量。"
            confidence = 0.64

        return {
            "trace_id": trace_id,
            "quality_status": "planned",
            "confidence": confidence,
            "rationale": rationale,
            "tool_steps": tool_steps,
        }

    def _extract_paper_config(self, goal: str) -> Dict[str, Any]:
        mode = "teacher" if "教师卷" in goal else "practice" if "练习卷" in goal else "teacher"
        total_questions = 6
        matched_count = re.search(r"(\d+)\s*道题", goal)
        if matched_count:
            total_questions = max(1, int(matched_count.group(1)))

        subject = None
        for candidate in ["数学", "语文", "英语", "物理", "化学", "生物", "历史", "地理", "政治"]:
            if candidate in goal:
                subject = candidate
                break
        grade_level = None
        for candidate in ["小学", "初中", "高中", "大学"]:
            if candidate in goal:
                grade_level = candidate
                break

        knowledge_points = []
        if "函数" in goal:
            knowledge_points.append("函数")
        if "导数" in goal:
            knowledge_points.append("导数")

        return {
            "title": "智能组卷",
            "subject": subject,
            "grade_level": grade_level,
            "total_questions": total_questions,
            "knowledge_points": knowledge_points,
            "mode": mode,
            "source_policy": "knowledge_first",
            "review_level": "strict" if mode == "teacher" else "normal",
            "difficulty_distribution": {"easy": 30, "medium": 50, "hard": 20},
            "question_type_distribution": {"choice": max(1, total_questions - max(1, total_questions // 3)), "fill": max(1, total_questions // 3)},
            "time_limit": 60,
            "total_score": 100,
        }


class AgentReviewer:
    """执行结果审核器"""

    def review(self, plan: Dict[str, Any], observations: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not observations:
            return {"quality_status": "failed", "confidence": 0.1, "needs_more_work": True, "evidence": []}

        evidence = [item for obs in observations for item in obs.get("evidence", [])]
        fallback_used = any(obs.get("fallback_used") for obs in observations)
        last_tool = observations[-1].get("tool_name")

        if last_tool == "review_paper_quality":
            report = observations[-1].get("quality_report", {})
            return {
                "quality_status": report.get("quality_status", "warning"),
                "confidence": max(0.55, observations[-1].get("confidence", 0.7)),
                "needs_more_work": False,
                "evidence": evidence,
                "fallback_used": fallback_used,
            }

        if all(obs.get("success") for obs in observations):
            quality_status = "warning" if fallback_used else "pass"
            return {
                "quality_status": quality_status,
                "confidence": min(0.95, sum(obs.get("confidence", 0.5) for obs in observations) / len(observations)),
                "needs_more_work": False,
                "evidence": evidence,
                "fallback_used": fallback_used,
            }

        return {
            "quality_status": "failed",
            "confidence": 0.2,
            "needs_more_work": False,
            "evidence": evidence,
            "fallback_used": fallback_used,
        }


class AgentExecutor:
    """Agent 执行引擎"""

    def __init__(self, db: Session, user_id: int, session_id: int, context: Dict[str, Any] = None):
        self.db = db
        self.user_id = user_id
        self.session_id = session_id
        self.tool_registry = ToolRegistry()
        self.planner = AgentPlanner(self.tool_registry)
        self.reviewer = AgentReviewer()
        self.agent_provider = FeatureModelConfigService.get_provider_for_feature(db, "agent") if db is not None else None
        self.final_answer_fallback_used = False
        session = AgentRepository.get_session(db, session_id) if db is not None else None
        self.context = context if context is not None else (session.context if session else {}) or {}
        self.attachments = self.context.get("attachments") or []

    def _record_step(self, step_number: int, step_type: str, content: Any, extra_data: Dict[str, Any]) -> None:
        content_text = content if isinstance(content, str) else json.dumps(content, ensure_ascii=False)
        AgentRepository.add_step(
            self.db,
            session_id=self.session_id,
            step_number=step_number,
            step_type=step_type,
            content=content_text,
            extra_data=extra_data,
        )

    def _next_step_number(self) -> int:
        if self.db is None:
            return 0
        return AgentRepository.get_next_step_number(self.db, self.session_id)

    def _get_conversation_items(self) -> List[tuple[str, str]]:
        if self.db is None:
            return []
        steps = AgentRepository.get_session_steps(self.db, self.session_id)
        conversation_items: List[tuple[str, str]] = []
        for step in steps:
            if step.step_type == "user_message" and step.content:
                conversation_items.append(("user", step.content.strip()))
            elif step.step_type == "final_answer" and step.content:
                conversation_items.append(("assistant", step.content.strip()))
        return conversation_items

    def _has_prior_assistant_answer(self) -> bool:
        return any(role == "assistant" and content for role, content in self._get_conversation_items())

    def _build_conversation_goal(self, latest_message: str) -> str:
        if self.db is None:
            return latest_message
        conversation_items = self._get_conversation_items()

        if len(conversation_items) <= 1:
            return latest_message

        latest_compact = latest_message.strip()
        history_lines = []
        for role, content in conversation_items[:-1][-6:]:
            prefix = "用户" if role == "user" else "助手"
            history_lines.append(f"{prefix}: {content}")

        return (
            "请结合当前会话的上文来回答当前问题。\n\n"
            "对话上下文：\n"
            f"{chr(10).join(history_lines)}\n\n"
            f"当前用户消息：\n{latest_compact}"
        )

    def _should_answer_from_context_directly(self, goal: str) -> bool:
        goal_text = (goal or "").strip()
        lower_goal = goal_text.lower()
        if not goal_text or not self._has_prior_assistant_answer():
            return False
        if not AgentPlanner._is_follow_up_query(goal_text, lower_goal):
            return False
        if AgentPlanner._is_search_intent(goal_text, lower_goal):
            return False
        if AgentPlanner._is_current_events_query(goal_text, lower_goal):
            return False
        if AgentPlanner._is_resource_recommendation_query(goal_text, lower_goal):
            return False
        if AgentPlanner._is_tech_learning_query(goal_text, lower_goal):
            return False
        return True

    @staticmethod
    def _dedupe_lines(lines: List[str]) -> List[str]:
        unique_lines: List[str] = []
        seen = set()
        for line in lines:
            normalized = re.sub(r"\s+", " ", (line or "").strip())
            if not normalized:
                continue
            key = normalized.lower()
            if key in seen:
                continue
            seen.add(key)
            unique_lines.append(normalized)
        return unique_lines

    def _resolve_dynamic_input(self, tool_input: Dict[str, Any], previous_output: Dict[str, Any]) -> Dict[str, Any]:
        resolved = {}
        for key, value in tool_input.items():
            if isinstance(value, str) and value.startswith("__from_previous__."):
                resolved[key] = previous_output.get(value.split(".", 1)[1])
            else:
                resolved[key] = value
        return resolved

    def _has_image_attachments(self) -> bool:
        for attachment in self.attachments:
            if attachment.get("file_type") == "image" or attachment.get("type") == "image":
                return True
        return False

    def _get_image_attachments(self) -> List[Dict[str, Any]]:
        return [
            attachment
            for attachment in self.attachments
            if attachment.get("file_type") == "image" or attachment.get("type") == "image"
        ]

    @staticmethod
    def _resolve_local_attachment_path(attachment: Dict[str, Any]) -> Optional[Path]:
        candidates: List[str] = []
        for key in ("file_path", "local_path"):
            value = attachment.get(key)
            if value:
                candidates.append(str(value))

        for key in ("image_url", "file_url", "preview_url"):
            value = attachment.get(key)
            if isinstance(value, str) and value.startswith("/uploads/"):
                candidates.append(value.lstrip("/"))

        backend_root = Path(__file__).resolve().parents[1]
        cwd = Path.cwd()
        seen: set[str] = set()

        for candidate in candidates:
            normalized = candidate.replace("\\", "/").strip()
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)

            candidate_path = Path(normalized)
            possible_paths = [candidate_path]
            if not candidate_path.is_absolute():
                possible_paths.extend([cwd / candidate_path, backend_root / candidate_path])

            for possible_path in possible_paths:
                if possible_path.exists() and possible_path.is_file():
                    return possible_path
        return None

    def _build_image_content_block(self, attachment: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        image_url = attachment.get("image_url") or attachment.get("file_url") or attachment.get("preview_url")
        if isinstance(image_url, str) and image_url.startswith(("http://", "https://", "data:")):
            return {"type": "input_image", "image_url": image_url}

        local_path = self._resolve_local_attachment_path(attachment)
        if local_path is None:
            logger.warning("Image attachment missing usable path for multimodal request: %s", attachment)
            return None

        mime_type = str(attachment.get("mime_type") or "").strip() or mimetypes.guess_type(local_path.name)[0] or "image/png"
        encoded = base64.b64encode(local_path.read_bytes()).decode("ascii")
        return {"type": "input_image", "image_url": f"data:{mime_type};base64,{encoded}"}

    def _augment_goal_with_file_hints(self, goal: str) -> str:
        file_blocks: List[str] = []
        for attachment in self.attachments:
            if attachment.get("file_type") == "image" or attachment.get("type") == "image":
                continue

            file_name = attachment.get("file_name") or attachment.get("name") or "unknown file"
            text_content = attachment.get("text_content") or ""

            if text_content:
                MAX_CONTEXT_LEN = 8000
                truncated = text_content[:MAX_CONTEXT_LEN]
                truncation_note = (
                    f" [文本过长，已截断至{MAX_CONTEXT_LEN}字符]"
                    if len(text_content) > MAX_CONTEXT_LEN else ""
                )
                file_blocks.append(
                    f'[已解析文件: "{file_name}"]\n'
                    f"```\n{truncated}{truncation_note}\n```\n"
                    "[注意: 以上文件内容已直接提供，无需再调用 parse_file 工具读取此文件。]"
                )
            else:
                file_path = attachment.get("file_path", "")
                file_blocks.append(
                    f'[附件: "{file_name}" (路径: {file_path})。'
                    "文件内容未被预解析，如需读取请使用 parse_file 工具。]"
                )

        if not file_blocks:
            return goal
        return f"{goal.strip()}\n\n## 附件内容\n\n" + "\n\n".join(file_blocks)

    async def _execute_multimodal_direct(self, goal: str, mode: str) -> Dict[str, Any]:
        capabilities = AIService.get_provider_capabilities(self.agent_provider, db=self.db)
        if not capabilities.get("supports_vision") or not capabilities.get("supports_responses_api"):
            raise ValueError("The current agent model does not support image understanding. Please switch to a vision-capable model.")

        content_blocks: List[Dict[str, Any]] = []
        for attachment in self._get_image_attachments():
            image_block = self._build_image_content_block(attachment)
            if image_block:
                content_blocks.append(image_block)
        if goal.strip():
            content_blocks.append({"type": "input_text", "text": goal.strip()})
        if not any(block.get("type") == "input_image" for block in content_blocks):
            raise ValueError("No valid image attachment found")

        result = await AIService.call_ai_async(
            input_items=[{"role": "user", "content": content_blocks}],
            system_prompt_name="system_prompt",
            provider=self.agent_provider,
            temperature=0.2 if mode != "cot" else 0.3,
            max_tokens=settings.AI_DEFAULT_MAX_TOKENS,
            quality_context={"mode": "agent_vision"},
        )
        answer = result.get("text", "").strip()
        if not answer:
            raise ValueError("The model returned an empty visual analysis result")
        return {
            "success": True,
            "answer": answer,
            "trace_id": result.get("trace_id"),
            "quality_status": result.get("quality_status", "pass"),
            "confidence": result.get("confidence", 0.82),
            "evidence": [{"type": "image_attachment", "summary": attachment.get("name") or "image"} for attachment in self._get_image_attachments()],
            "fallback_used": result.get("fallback_used", False),
        }

    async def _execute_contextual_followup_direct(self, goal: str, mode: str) -> Dict[str, Any]:
        result = await AIService.call_ai_async(
            user_prompt=goal,
            system_prompt_name="system_prompt",
            provider=self.agent_provider,
            temperature=0.2 if mode != "cot" else 0.3,
            max_tokens=settings.AI_DEFAULT_MAX_TOKENS,
            quality_context={"mode": "agent_context_followup"},
            instructions="Answer directly from the current conversation context. Do not browse or call tools unless the user explicitly asks for fresh external information.",
        )
        answer = (result.get("text") or "").strip()
        if not answer:
            raise ValueError("The model returned an empty contextual follow-up result")
        return {
            "success": True,
            "answer": answer,
            "trace_id": result.get("trace_id"),
            "quality_status": result.get("quality_status", "pass"),
            "confidence": result.get("confidence", 0.82),
            "evidence": result.get("evidence", []),
            "fallback_used": result.get("fallback_used", False),
        }

    async def _execute_semantic_direct_answer(self, goal: str, mode: str) -> Dict[str, Any]:
        result = await AIService.call_ai_async(
            user_prompt=goal,
            system_prompt_name="system_prompt",
            provider=self.agent_provider,
            temperature=0.2 if mode != "cot" else 0.3,
            max_tokens=settings.AI_DEFAULT_MAX_TOKENS,
            quality_context={"mode": "agent_semantic_direct_answer"},
            instructions="Answer directly using the current request and conversation context. Do not browse or call tools unless fresh external information is explicitly required.",
        )
        answer = (result.get("text") or "").strip()
        if not answer:
            raise ValueError("The model returned an empty direct answer result")
        return {
            "success": True,
            "answer": answer,
            "trace_id": result.get("trace_id"),
            "quality_status": result.get("quality_status", "pass"),
            "confidence": result.get("confidence", 0.8),
            "evidence": result.get("evidence", []),
            "fallback_used": result.get("fallback_used", False),
        }

    def _should_run_semantic_router(self, goal: str) -> bool:
        goal_text = AgentPlanner._clean_query_text(AgentPlanner._extract_current_user_message(goal))
        if not goal_text:
            return False
        lower_goal = goal_text.lower()
        if AgentPlanner._is_paper_generation_query(goal_text):
            return False
        if AgentPlanner._is_learning_map_query(goal_text, lower_goal):
            return False
        return True

    @staticmethod
    def _extract_json_object(text: str) -> Optional[Dict[str, Any]]:
        payload = (text or "").strip()
        if not payload:
            return None

        fenced_match = re.search(r"```(?:json)?\s*(\{[\s\S]*\})\s*```", payload, re.IGNORECASE)
        if fenced_match:
            payload = fenced_match.group(1).strip()
        else:
            start = payload.find("{")
            end = payload.rfind("}")
            if start >= 0 and end > start:
                payload = payload[start:end + 1]

        parsed = json.loads(payload)
        if isinstance(parsed, dict):
            return parsed
        return None

    def _normalize_semantic_route(self, route_payload: Dict[str, Any], goal: str) -> Optional[Dict[str, Any]]:
        intent = str(route_payload.get("intent") or "").strip().lower()
        if intent not in SEMANTIC_ROUTE_INTENTS:
            return None

        confidence_raw = route_payload.get("confidence", 0)
        try:
            confidence = float(confidence_raw)
        except (TypeError, ValueError):
            confidence = 0.0

        rewritten_query = str(route_payload.get("rewritten_query") or "").strip()
        if not rewritten_query:
            rewritten_query = AgentPlanner._build_context_aware_query(goal)

        preferred_tool = str(route_payload.get("preferred_tool") or "none").strip().lower()
        if preferred_tool not in {"web_search", "search_knowledge", "generate_study_plan", "build_learning_map", "none"}:
            preferred_tool = "none"

        return {
            "intent": intent,
            "needs_tool": bool(route_payload.get("needs_tool", False)),
            "needs_fresh_info": bool(route_payload.get("needs_fresh_info", False)),
            "preferred_tool": preferred_tool,
            "rewritten_query": rewritten_query,
            "is_followup": bool(route_payload.get("is_followup", False)),
            "confidence": confidence,
        }

    async def _run_semantic_router(self, goal: str) -> Optional[Dict[str, Any]]:
        if not self._should_run_semantic_router(goal):
            return None
        if self.db is None:
            return None

        try:
            result = await AIService.call_ai_async(
                user_prompt=goal,
                system_prompt_name=SEMANTIC_ROUTE_PROMPT_NAME,
                provider=self.agent_provider,
                temperature=0,
                max_tokens=320,
                quality_context={"mode": "agent_semantic_router"},
                instructions="Return JSON only.",
            )
            route_payload = self._extract_json_object(result.get("text", ""))
            if not route_payload:
                return None
            route = self._normalize_semantic_route(route_payload, goal)
            if not route or route["confidence"] < SEMANTIC_ROUTE_CONFIDENCE_THRESHOLD:
                return None
            return route
        except Exception as exc:  # pylint: disable=broad-except
            logger.warning("Semantic router unavailable, falling back to planner: %s", exc)
            return None

    def _build_plan_from_semantic_route(
        self,
        goal: str,
        route: Optional[Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        if not route:
            return None

        intent = route["intent"]
        query = route.get("rewritten_query") or AgentPlanner._build_context_aware_query(goal)
        goal_text = AgentPlanner._clean_query_text(AgentPlanner._extract_current_user_message(goal))

        if intent == "paper_generation" or intent == "learning_map":
            return self.planner.plan(goal)

        if intent == "fresh_search":
            return {
                "trace_id": str(uuid4()),
                "quality_status": "planned",
                "confidence": route["confidence"],
                "rationale": "语义路由判断当前问题需要最新外部信息，优先执行联网搜索。",
                "tool_steps": [
                    {
                        "tool_name": "web_search",
                        "tool_input": {"query": query, "max_results": 8},
                        "reason": "需要获取最新事实或实时信息。",
                    }
                ],
            }

        if intent == "resource_recommendation":
            return {
                "trace_id": str(uuid4()),
                "quality_status": "planned",
                "confidence": route["confidence"],
                "rationale": "语义路由判断当前问题以外部资源推荐为主，优先执行联网搜索。",
                "tool_steps": [
                    {
                        "tool_name": "web_search",
                        "tool_input": {"query": query, "max_results": 8},
                        "reason": "需要发现最新或更合适的外部资源。",
                    }
                ],
            }

        if intent == "knowledge_lookup":
            return {
                "trace_id": str(uuid4()),
                "quality_status": "planned",
                "confidence": route["confidence"],
                "rationale": "语义路由判断当前问题更适合先查本地知识库证据。",
                "tool_steps": [
                    {
                        "tool_name": "search_knowledge",
                        "tool_input": {"query": query, "limit": 5},
                        "reason": "优先复用本地知识库中的概念、公式与证据。",
                    }
                ],
            }

        if intent == "study_plan":
            tool_steps: List[Dict[str, Any]] = [
                {
                    "tool_name": "search_knowledge",
                    "tool_input": {"query": query, "limit": 5},
                    "reason": "先补充学习主题相关证据，再生成分阶段计划。",
                },
                {
                    "tool_name": "generate_study_plan",
                    "tool_input": {"goal": goal_text},
                    "reason": "根据目标生成学习计划。",
                },
            ]
            return {
                "trace_id": str(uuid4()),
                "quality_status": "planned",
                "confidence": route["confidence"],
                "rationale": "语义路由判断当前请求以学习路径/学习计划输出为主。",
                "tool_steps": tool_steps,
            }

        return None

    def _get_provider_capabilities(self) -> Dict[str, Any]:
        return AIService.get_provider_capabilities(self.agent_provider, db=self.db)

    def _get_native_search_mode(self) -> str:
        capabilities = self._get_provider_capabilities()
        return str(capabilities.get("native_search_mode") or "none").strip().lower()

    def _provider_supports_native_tool(self, tool_name: str) -> bool:
        capabilities = self._get_provider_capabilities()
        native_search_mode = str(capabilities.get("native_search_mode") or "none").strip().lower()
        if native_search_mode == "qwen_chat_enable_search":
            return tool_name == "web_search"
        native_tools = capabilities.get("native_tools") or []
        return bool(native_search_mode == "responses_builtin_tools" and tool_name in native_tools)

    def _should_try_native_tools_first(self, goal: str, route: Optional[Dict[str, Any]] = None) -> bool:
        goal_text = AgentPlanner._clean_query_text(AgentPlanner._extract_current_user_message(goal))
        lower_goal = goal_text.lower()
        if route and route.get("intent") in {"fresh_search", "resource_recommendation"}:
            return self._provider_supports_native_tool("web_search")
        return self._provider_supports_native_tool("web_search") and (
            AgentPlanner._is_current_events_query(goal_text, lower_goal)
            or AgentPlanner._is_explicit_search_request(goal_text, lower_goal)
            or AgentPlanner._is_resource_recommendation_query(goal_text, lower_goal)
        )

    @staticmethod
    def _normalize_native_tool_name(tool_call: Dict[str, Any]) -> Optional[str]:
        if not isinstance(tool_call, dict):
            return None

        candidates = [
            tool_call.get("tool_name"),
            tool_call.get("name"),
            tool_call.get("type"),
        ]
        for value in candidates:
            if not isinstance(value, str):
                continue
            normalized = value.strip()
            if not normalized:
                continue
            if normalized.endswith("_call"):
                normalized = normalized[: -len("_call")]
            if normalized in {"tool", "tool_call", "function", "function_call", "message"}:
                continue
            return normalized
        return None

    @classmethod
    def _normalize_native_tool_input(cls, tool_call: Dict[str, Any]) -> Dict[str, Any]:
        for key in ("arguments", "input", "params"):
            value = tool_call.get(key)
            if value is None:
                continue
            try:
                return cls._parse_native_tool_arguments(value)
            except Exception:  # pylint: disable=broad-except
                if isinstance(value, dict):
                    return value

        query = tool_call.get("query")
        if isinstance(query, str) and query.strip():
            return {"query": query.strip()}
        return {}

    @classmethod
    def _build_native_tool_observation(
        cls,
        tool_call: Dict[str, Any],
        *,
        fallback_used: bool,
    ) -> Dict[str, Any]:
        tool_name = cls._normalize_native_tool_name(tool_call) or "native_tool"
        tool_input = cls._normalize_native_tool_input(tool_call)
        output = tool_call.get("output") or tool_call.get("result") or tool_call
        summary = (
            tool_call.get("summary")
            or tool_call.get("description")
            or "由模型原生工具完成调用，结果已用于当前回答。"
        )
        return {
            "tool_name": tool_name,
            "success": True,
            "quality_status": "verified",
            "confidence": 0.86,
            "evidence": [],
            "fallback_used": fallback_used,
            "tool_input": tool_input,
            "output_summary": summary,
            "output": output,
            "native_tool": True,
        }

    async def _try_native_tool_run(
        self,
        goal: str,
        mode: str,
        route: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        should_try_native = (
            self._should_try_native_tools_first(goal, route)
            if route is not None
            else self._should_try_native_tools_first(goal)
        )
        if not should_try_native:
            return None

        query_text = (route or {}).get("rewritten_query") or AgentPlanner._build_context_aware_query(goal)
        if not query_text:
            query_text = goal

        native_search_mode = self._get_native_search_mode()
        extra_model_args: Dict[str, Any]
        if native_search_mode == "qwen_chat_enable_search":
            extra_model_args = {
                "enable_search": True,
                "search_options": {
                    "forced_search": True,
                    "search_strategy": "turbo",
                },
            }
        elif native_search_mode == "responses_builtin_tools":
            extra_model_args = {
                "tools": [{"type": "web_search"}],
            }
        else:
            return None

        try:
            result = await AIService.call_ai_async(
                user_prompt=query_text,
                system_prompt_name="system_prompt",
                provider=self.agent_provider,
                temperature=0.2 if mode != "cot" else 0.3,
                max_tokens=settings.AI_DEFAULT_MAX_TOKENS,
                quality_context={"mode": "agent_native_tools", "tool_priority": "native_first"},
                instructions="For quality-sensitive or up-to-date questions, prefer provider-native web search before answering.",
                extra_model_args=extra_model_args,
            )
        except Exception as exc:  # pylint: disable=broad-except
            logger.warning("Native tool preflight unavailable, falling back to local tools: %s", exc)
            return None

        answer = (result.get("text") or "").strip()
        if not answer:
            return None

        observations: List[Dict[str, Any]]
        if native_search_mode == "qwen_chat_enable_search":
            observations = [
                {
                    "tool_name": "web_search",
                    "success": True,
                    "quality_status": "verified",
                    "confidence": 0.84,
                    "evidence": [],
                    "fallback_used": result.get("fallback_used", False),
                    "tool_input": {
                        "query": query_text,
                        "forced_search": True,
                        "search_strategy": "turbo",
                    },
                    "output_summary": "已通过 Qwen Chat Completions 的 `enable_search` 能力完成联网搜索。",
                    "output": {
                        "provider_format": ((result.get("metadata") or {}).get("provider_format")),
                        "usage": ((result.get("metadata") or {}).get("usage") or {}),
                    },
                    "native_tool": True,
                }
            ]
        else:
            tool_calls = result.get("tool_calls") or []
            if not tool_calls:
                return None
            observations = [
                self._build_native_tool_observation(
                    tool_call,
                    fallback_used=bool(result.get("fallback_used", False)),
                )
                for tool_call in tool_calls
            ]

        evidence = [item for obs in observations for item in obs.get("evidence", [])]
        return {
            "success": True,
            "answer": answer,
            "trace_id": result.get("trace_id"),
            "quality_status": result.get("quality_status", "pass"),
            "confidence": result.get("confidence", 0.86),
            "evidence": evidence,
            "fallback_used": result.get("fallback_used", False),
            "observations": observations,
        }

    @staticmethod
    def _goal_prefers_live_search(goal: str) -> bool:
        goal_text = AgentPlanner._clean_query_text(AgentPlanner._extract_current_user_message(goal))
        lower_goal = goal_text.lower()
        return (
            AgentPlanner._is_current_events_query(goal_text, lower_goal)
            or AgentPlanner._is_explicit_search_request(goal_text, lower_goal)
            or AgentPlanner._has_resource_intent(goal_text, lower_goal)
        )

    @staticmethod
    def _observation_has_useful_results(observation: Dict[str, Any]) -> bool:
        if observation.get("evidence"):
            return True
        if observation.get("results"):
            return True
        if observation.get("count", 0):
            return True
        if observation.get("fallback_used"):
            return False

        text = (observation.get("text") or "").strip()
        if not text:
            return False
        return not any(marker in text for marker in META_EVIDENCE_MARKERS)

    def _should_add_supplemental_web_search(
        self,
        goal: str,
        observation: Dict[str, Any],
        previous_observations: List[Dict[str, Any]],
    ) -> bool:
        if observation.get("tool_name") != "search_knowledge":
            return False
        if not self._goal_prefers_live_search(goal):
            return False
        if any(item.get("tool_name") == "web_search" for item in previous_observations):
            return False
        return not self._observation_has_useful_results(observation)

    async def _execute_tool_step(
        self,
        trace_id: str,
        step_number: int,
        tool_name: str,
        tool_input: Dict[str, Any],
    ) -> Dict[str, Any]:
        action_extra = {
            "trace_id": trace_id,
            "step_id": step_number,
            "tool_name": tool_name,
            "tool_input": tool_input,
        }
        self._record_step(step_number, "action", f"{tool_name}: {json.dumps(tool_input, ensure_ascii=False)}", action_extra)
        tool_call = AgentRepository.create_tool_call(
            self.db,
            session_id=self.session_id,
            tool_name=tool_name,
            input_params=tool_input,
        )
        tool = self.tool_registry.get_tool(tool_name)
        if not tool:
            result = {
                "success": False,
                "error": f"工具不存在: {tool_name}",
                "quality_status": "failed",
                "confidence": 0.0,
                "evidence": [],
                "fallback_used": False,
            }
        else:
            result = await tool.execute(self.db, self.user_id, **tool_input)

        wrapped = {
            "tool_name": tool_name,
            "trace_id": trace_id,
            "step_id": step_number + 1,
            "success": result.get("success", False),
            "quality_status": result.get("quality_status", "warning"),
            "confidence": result.get("confidence", 0.5),
            "evidence": result.get("evidence", []),
            "fallback_used": result.get("fallback_used", False),
            **{key: value for key, value in result.items() if key not in {"success", "quality_status", "confidence", "evidence", "fallback_used"}},
        }
        AgentRepository.update_tool_call(
            self.db,
            tool_call_id=tool_call.id,
            status="success" if wrapped["success"] else "failed",
            output_result=wrapped,
            error_message=wrapped.get("error"),
        )
        self._record_step(
            step_number + 1,
            "observation",
            wrapped,
            {
                "trace_id": trace_id,
                "step_id": step_number + 1,
                "quality_status": wrapped["quality_status"],
                "confidence": wrapped["confidence"],
                "evidence": wrapped["evidence"],
                "fallback_used": wrapped["fallback_used"],
            },
        )
        return wrapped

    def _build_final_answer_fallback(self, goal: str, plan: Dict[str, Any], observations: List[Dict[str, Any]], review: Dict[str, Any]) -> str:
        sections: List[str] = []

        if observations and observations[-1].get("blueprint"):
            blueprint = observations[-1]["blueprint"]
            sections.append(
                "## 正式回答\n"
                "我已经根据你的要求完成试卷蓝图设计，关键信息如下：\n"
                f"- 组卷模式：{blueprint['mode']}\n"
                f"- 总题数：{blueprint['total_questions']}\n"
                f"- 覆盖知识点：{', '.join(blueprint.get('knowledge_points') or ['综合能力'])}"
            )

        generated_questions = None
        quality_report = None
        for observation in observations:
            if observation.get("questions"):
                generated_questions = observation["questions"]
            if observation.get("quality_report"):
                quality_report = observation["quality_report"]

        if quality_report:
            sections.append(
                "### 关键结果\n"
                f"- 审核状态：{quality_report.get('quality_status')}\n"
                f"- 质量分：{quality_report.get('score')}\n"
                f"- 重复率：{quality_report.get('duplicate_rate')}\n"
                f"- 覆盖知识点：{', '.join(quality_report.get('coverage_knowledge_points') or [])}"
            )
        elif generated_questions:
            preview = []
            for question in generated_questions[:3]:
                preview.append(f"- {question.get('question_id')}: {question.get('stem')}")
            sections.append(
                "## 正式回答\n"
                "我已经根据你的要求生成了题目，先给你一个简短预览：\n"
                + "\n".join(preview)
            )
        else:
            evidence_lines = []
            for evidence in review.get("evidence", [])[:5]:
                line = evidence.get("summary") or evidence.get("excerpt") or "证据"
                evidence_lines.append(line)
            evidence_lines = self._dedupe_lines(evidence_lines)
            if evidence_lines:
                sections.append(
                    "## 正式回答\n"
                    "我根据当前检索到的结果，先给你一个简短总结：\n"
                    + "\n".join(f"- {line}" for line in evidence_lines[:4])
                )
            else:
                sections.append(
                    "## 正式回答\n"
                    "我已经完成当前任务，但最终整理步骤暂时不可用。你可以先参考上方执行过程中的工具结果，我也可以继续为你重新整理成正式答复。"
                )
        return "\n\n".join(sections)

    def _build_final_answer_prompt(
        self,
        goal: str,
        plan: Dict[str, Any],
        observations: List[Dict[str, Any]],
        review: Dict[str, Any],
    ) -> str:
        evidence_text = "\n".join(
            f"- {item.get('summary') or item.get('excerpt') or ''}"
            for item in review.get("evidence", [])[:8]
        )
        return f"""
你是智学伴的正式答复撰写助手。请基于工具证据，直接生成一份给用户看的最终回答。

输出要求：
1. 第一段必须直接回答用户，不要复述“任务目标”。
2. 不要输出 trace_id、quality_status、confidence、fallback_used、证据摘要 这类内部字段名。
3. 如果是检索/资讯类任务，优先给 2-4 条简明总结，再补一句结论。
4. 如果是学习计划/组卷/导图类任务，先明确“已完成什么”，再给关键结果。
5. 允许使用 Markdown，建议以“## 正式回答”开头，但不要堆砌技术性标题。
6. 语言自然、明确、像最终交付给用户的正式回复。

目标：{goal}
规划理由：{plan.get('rationale')}
质量状态：{review.get('quality_status')}
置信度：{review.get('confidence')}

证据：
{evidence_text or '暂无外部证据'}

工具结果摘要：
{json.dumps(observations, ensure_ascii=False)[:4000]}
"""

    def _build_final_answer(self, goal: str, plan: Dict[str, Any], observations: List[Dict[str, Any]], review: Dict[str, Any]) -> str:
        prompt = self._build_final_answer_prompt(goal, plan, observations, review)
        self.final_answer_fallback_used = False
        try:
            result = AIService.call_ai(
                db=self.db,
                user_prompt=prompt,
                system_prompt_name="system_prompt",
                temperature=0.2,
                max_tokens=settings.AI_DEFAULT_MAX_TOKENS,
                provider=self.agent_provider,
            )
            text = result.get("text", "").strip()
            if text:
                return text
        except Exception as exc:
            logger.warning("最终答案 AI 生成失败，回退到模板拼装: %s", exc)
        self.final_answer_fallback_used = True
        return self._build_final_answer_fallback(goal, plan, observations, review)

    async def _build_final_answer_async(
        self,
        goal: str,
        plan: Dict[str, Any],
        observations: List[Dict[str, Any]],
        review: Dict[str, Any],
    ) -> str:
        prompt = self._build_final_answer_prompt(goal, plan, observations, review)
        self.final_answer_fallback_used = False
        try:
            result = await AIService.call_ai_async(
                user_prompt=prompt,
                system_prompt_name="system_prompt",
                temperature=0.2,
                max_tokens=settings.AI_DEFAULT_MAX_TOKENS,
                provider=self.agent_provider,
            )
            text = result.get("text", "").strip()
            if text:
                return text
        except Exception as exc:
            logger.warning("最终答案 AI 生成失败，回退到模板拼装: %s", exc)
        self.final_answer_fallback_used = True
        return self._build_final_answer_fallback(goal, plan, observations, review)

    async def execute_react(self, goal: str) -> Dict[str, Any]:
        try:
            raw_goal = self._augment_goal_with_file_hints((goal or "").strip())
            actual_goal = self._augment_goal_with_file_hints(self._build_conversation_goal(goal))
            base_step = self._next_step_number()
            if self._has_image_attachments():
                direct_result = await self._execute_multimodal_direct(actual_goal, "react")
                self._record_step(base_step, "goal", actual_goal, {})
                self._record_step(
                    base_step + 1,
                    "final_answer",
                    direct_result["answer"],
                    {
                        "quality_status": direct_result.get("quality_status"),
                        "confidence": direct_result.get("confidence"),
                        "evidence": direct_result.get("evidence", []),
                        "fallback_used": direct_result.get("fallback_used", False),
                    },
                )
                AgentRepository.update_session_status(self.db, self.session_id, "completed")
                return {**direct_result, "iterations": 1}

            if self._should_answer_from_context_directly(raw_goal):
                direct_result = await self._execute_contextual_followup_direct(actual_goal, "react")
                self._record_step(base_step, "goal", actual_goal, {})
                self._record_step(
                    base_step + 1,
                    "thought",
                    "检测到当前问题是在同一会话里继续追问细节，直接基于上文展开说明，无需额外检索。",
                    {
                        "quality_status": direct_result.get("quality_status"),
                        "confidence": direct_result.get("confidence"),
                    },
                )
                self._record_step(
                    base_step + 2,
                    "final_answer",
                    direct_result["answer"],
                    {
                        "quality_status": direct_result.get("quality_status"),
                        "confidence": direct_result.get("confidence"),
                        "evidence": direct_result.get("evidence", []),
                        "fallback_used": direct_result.get("fallback_used", False),
                    },
                )
                AgentRepository.update_session_status(self.db, self.session_id, "completed")
                return {**direct_result, "iterations": 1}

            semantic_route = await self._run_semantic_router(actual_goal)

            if semantic_route and semantic_route["intent"] == "direct_answer" and not semantic_route.get("needs_tool"):
                direct_result = await self._execute_semantic_direct_answer(actual_goal, "react")
                self._record_step(base_step, "goal", actual_goal, {})
                self._record_step(
                    base_step + 1,
                    "thought",
                    "语义路由判断当前问题可直接回答，无需额外调用工具。",
                    {
                        "quality_status": direct_result.get("quality_status"),
                        "confidence": semantic_route.get("confidence", direct_result.get("confidence")),
                    },
                )
                self._record_step(
                    base_step + 2,
                    "final_answer",
                    direct_result["answer"],
                    {
                        "quality_status": direct_result.get("quality_status"),
                        "confidence": direct_result.get("confidence"),
                        "evidence": direct_result.get("evidence", []),
                        "fallback_used": direct_result.get("fallback_used", False),
                    },
                )
                AgentRepository.update_session_status(self.db, self.session_id, "completed")
                return {**direct_result, "iterations": 1}

            native_result = (
                await self._try_native_tool_run(actual_goal, "react", semantic_route)
                if semantic_route is not None
                else await self._try_native_tool_run(actual_goal, "react")
            )
            if native_result:
                trace_id = native_result.get("trace_id") or str(uuid4())
                step_number = base_step
                self._record_step(step_number, "goal", actual_goal, {"trace_id": trace_id, "step_id": step_number})
                step_number += 1
                self._record_step(
                    step_number,
                    "thought",
                    "已优先使用模型原生工具完成本轮检索，再整合为最终回答。",
                    {
                        "trace_id": trace_id,
                        "step_id": step_number,
                        "quality_status": native_result.get("quality_status"),
                        "confidence": native_result.get("confidence"),
                        "native_tool": True,
                    },
                )
                for observation in native_result.get("observations", []):
                    step_number += 1
                    tool_input = observation.get("tool_input") or {}
                    self._record_step(
                        step_number,
                        "action",
                        f'{observation["tool_name"]}: {json.dumps(tool_input, ensure_ascii=False)}',
                        {
                            "trace_id": trace_id,
                            "step_id": step_number,
                            "tool_name": observation["tool_name"],
                            "tool_input": tool_input,
                            "native_tool": True,
                        },
                    )
                    step_number += 1
                    self._record_step(
                        step_number,
                        "observation",
                        observation,
                        {
                            "trace_id": trace_id,
                            "step_id": step_number,
                            "tool_name": observation["tool_name"],
                            "quality_status": observation.get("quality_status"),
                            "confidence": observation.get("confidence"),
                            "fallback_used": observation.get("fallback_used", False),
                            "native_tool": True,
                        },
                    )
                final_step_number = step_number + 1
                self._record_step(
                    final_step_number,
                    "final_answer",
                    native_result["answer"],
                    {
                        "trace_id": trace_id,
                        "step_id": final_step_number,
                        "quality_status": native_result.get("quality_status"),
                        "confidence": native_result.get("confidence"),
                        "evidence": native_result.get("evidence", []),
                        "fallback_used": native_result.get("fallback_used", False),
                        "native_tool": True,
                    },
                )
                AgentRepository.update_session_status(self.db, self.session_id, "completed")
                return {
                    **native_result,
                    "iterations": len(native_result.get("observations", [])),
                }

            plan = self._build_plan_from_semantic_route(actual_goal, semantic_route) or self.planner.plan(actual_goal)
            trace_id = plan["trace_id"]
            step_number = base_step
            self._record_step(step_number, "goal", actual_goal, {"trace_id": trace_id, "step_id": step_number})
            step_number += 1
            self._record_step(
                step_number,
                "thought",
                plan["rationale"],
                {
                    "trace_id": trace_id,
                    "step_id": step_number,
                    "quality_status": plan["quality_status"],
                    "confidence": plan["confidence"],
                },
            )

            observations: List[Dict[str, Any]] = []
            previous_output: Dict[str, Any] = {}
            for tool_step in plan["tool_steps"]:
                step_number += 1
                resolved_input = self._resolve_dynamic_input(tool_step["tool_input"], previous_output)
                observation = await self._execute_tool_step(
                    trace_id=trace_id,
                    step_number=step_number,
                    tool_name=tool_step["tool_name"],
                    tool_input=resolved_input,
                )
                observations.append(observation)
                previous_output = {**previous_output, **observation}
                step_number += 1

                if self._should_add_supplemental_web_search(actual_goal, observation, observations):
                    supplemental_input = {"query": actual_goal, "max_results": 5}
                    supplemental_observation = await self._execute_tool_step(
                        trace_id=trace_id,
                        step_number=step_number,
                        tool_name="web_search",
                        tool_input=supplemental_input,
                    )
                    observations.append(supplemental_observation)
                    previous_output = {**previous_output, **supplemental_observation}
                    step_number += 1

            review = self.reviewer.review(plan, observations)
            final_answer = await self._build_final_answer_async(actual_goal, plan, observations, review)
            review["fallback_used"] = review.get("fallback_used", False) or self.final_answer_fallback_used
            final_step_number = step_number + 1
            self._record_step(
                final_step_number,
                "final_answer",
                final_answer,
                {
                    "trace_id": trace_id,
                    "step_id": final_step_number,
                    "quality_status": review["quality_status"],
                    "confidence": review["confidence"],
                    "evidence": review.get("evidence", []),
                    "fallback_used": review.get("fallback_used", False),
                },
            )
            AgentRepository.update_session_status(self.db, self.session_id, "completed")
            return {
                "success": True,
                "answer": final_answer,
                "iterations": len(observations),
                "trace_id": trace_id,
                "quality_status": review["quality_status"],
                "confidence": review["confidence"],
                "evidence": review.get("evidence", []),
                "fallback_used": review.get("fallback_used", False),
            }
        except Exception as exc:
            logger.error("结构化 Agent 执行失败: %s", exc, exc_info=True)
            AgentRepository.update_session_status(self.db, self.session_id, "failed")
            return {"success": False, "error": str(exc)}

    async def execute_react_stream(self, goal: str) -> AsyncGenerator[Dict[str, Any], None]:
        raw_goal = self._augment_goal_with_file_hints((goal or "").strip())
        actual_goal = self._augment_goal_with_file_hints(self._build_conversation_goal(goal))
        base_step = self._next_step_number()
        if self._has_image_attachments():
            self._record_step(base_step, "goal", actual_goal, {})
            yield {"type": "goal", "content": actual_goal, "step_number": base_step}
            result = await self._execute_multimodal_direct(actual_goal, "react")
            self._record_step(
                base_step + 1,
                "final_answer",
                result["answer"],
                {
                    "quality_status": result.get("quality_status"),
                    "confidence": result.get("confidence"),
                    "evidence": result.get("evidence", []),
                    "fallback_used": result.get("fallback_used", False),
                },
            )
            AgentRepository.update_session_status(self.db, self.session_id, "completed")
            yield {
                "type": "final_answer",
                "content": result["answer"],
                "step_number": base_step + 1,
                "quality_status": result.get("quality_status", "pass"),
                "confidence": result.get("confidence", 0.82),
                "evidence": result.get("evidence", []),
                "fallback_used": result.get("fallback_used", False),
            }
            yield {
                "type": "completed",
                "quality_status": result.get("quality_status", "pass"),
                "confidence": result.get("confidence", 0.82),
                "fallback_used": result.get("fallback_used", False),
            }
            return

        if self._should_answer_from_context_directly(raw_goal):
            self._record_step(base_step, "goal", actual_goal, {})
            yield {"type": "goal", "content": actual_goal, "step_number": base_step}
            await asyncio.sleep(0.05)
            self._record_step(
                base_step + 1,
                "thought",
                "检测到当前问题是在同一会话里继续追问细节，直接基于上文展开说明，无需额外检索。",
                {
                    "quality_status": "pass",
                    "confidence": 0.82,
                },
            )
            yield {
                "type": "thought",
                "content": "检测到当前问题是在同一会话里继续追问细节，直接基于上文展开说明，无需额外检索。",
                "step_number": base_step + 1,
                "quality_status": "pass",
                "confidence": 0.82,
            }
            await asyncio.sleep(0.05)
            result = await self._execute_contextual_followup_direct(actual_goal, "react")
            self._record_step(
                base_step + 2,
                "final_answer",
                result["answer"],
                {
                    "quality_status": result.get("quality_status"),
                    "confidence": result.get("confidence"),
                    "evidence": result.get("evidence", []),
                    "fallback_used": result.get("fallback_used", False),
                },
            )
            AgentRepository.update_session_status(self.db, self.session_id, "completed")
            yield {
                "type": "final_answer",
                "content": result["answer"],
                "step_number": base_step + 2,
                "quality_status": result.get("quality_status", "pass"),
                "confidence": result.get("confidence", 0.82),
                "evidence": result.get("evidence", []),
                "fallback_used": result.get("fallback_used", False),
            }
            yield {
                "type": "completed",
                "quality_status": result.get("quality_status", "pass"),
                "confidence": result.get("confidence", 0.82),
                "fallback_used": result.get("fallback_used", False),
            }
            return

        semantic_route = await self._run_semantic_router(actual_goal)

        if semantic_route and semantic_route["intent"] == "direct_answer" and not semantic_route.get("needs_tool"):
            self._record_step(base_step, "goal", actual_goal, {})
            yield {"type": "goal", "content": actual_goal, "step_number": base_step}
            await asyncio.sleep(0.05)
            self._record_step(
                base_step + 1,
                "thought",
                "语义路由判断当前问题可直接回答，无需额外调用工具。",
                {
                    "quality_status": "pass",
                    "confidence": semantic_route.get("confidence", 0.8),
                },
            )
            yield {
                "type": "thought",
                "content": "语义路由判断当前问题可直接回答，无需额外调用工具。",
                "step_number": base_step + 1,
                "quality_status": "pass",
                "confidence": semantic_route.get("confidence", 0.8),
            }
            await asyncio.sleep(0.05)
            result = await self._execute_semantic_direct_answer(actual_goal, "react")
            self._record_step(
                base_step + 2,
                "final_answer",
                result["answer"],
                {
                    "quality_status": result.get("quality_status"),
                    "confidence": result.get("confidence"),
                    "evidence": result.get("evidence", []),
                    "fallback_used": result.get("fallback_used", False),
                },
            )
            AgentRepository.update_session_status(self.db, self.session_id, "completed")
            yield {
                "type": "final_answer",
                "content": result["answer"],
                "step_number": base_step + 2,
                "quality_status": result.get("quality_status", "pass"),
                "confidence": result.get("confidence", 0.8),
                "evidence": result.get("evidence", []),
                "fallback_used": result.get("fallback_used", False),
            }
            yield {
                "type": "completed",
                "quality_status": result.get("quality_status", "pass"),
                "confidence": result.get("confidence", 0.8),
                "fallback_used": result.get("fallback_used", False),
            }
            return

        native_result = (
            await self._try_native_tool_run(actual_goal, "react", semantic_route)
            if semantic_route is not None
            else await self._try_native_tool_run(actual_goal, "react")
        )
        if native_result:
            trace_id = native_result.get("trace_id") or str(uuid4())
            step_number = base_step
            self._record_step(step_number, "goal", actual_goal, {"trace_id": trace_id, "step_id": step_number})
            yield {"type": "goal", "content": actual_goal, "step_number": step_number, "trace_id": trace_id}
            await asyncio.sleep(0.05)
            step_number += 1
            self._record_step(
                step_number,
                "thought",
                "已优先使用模型原生工具完成本轮检索，再整合为最终回答。",
                {
                    "trace_id": trace_id,
                    "step_id": step_number,
                    "quality_status": native_result.get("quality_status"),
                    "confidence": native_result.get("confidence"),
                    "native_tool": True,
                },
            )
            yield {
                "type": "thought",
                "content": "已优先使用模型原生工具完成本轮检索，再整合为最终回答。",
                "step_number": step_number,
                "trace_id": trace_id,
                "quality_status": native_result.get("quality_status"),
                "confidence": native_result.get("confidence"),
            }
            await asyncio.sleep(0.05)

            for observation in native_result.get("observations", []):
                step_number += 1
                tool_input = observation.get("tool_input") or {}
                self._record_step(
                    step_number,
                    "action",
                    f'{observation["tool_name"]}: {json.dumps(tool_input, ensure_ascii=False)}',
                    {
                        "trace_id": trace_id,
                        "step_id": step_number,
                        "tool_name": observation["tool_name"],
                        "tool_input": tool_input,
                        "native_tool": True,
                    },
                )
                yield {
                    "type": "action",
                    "tool_name": observation["tool_name"],
                    "tool_input": tool_input,
                    "step_number": step_number,
                    "trace_id": trace_id,
                    "native_tool": True,
                }
                step_number += 1
                self._record_step(
                    step_number,
                    "observation",
                    observation,
                    {
                        "trace_id": trace_id,
                        "step_id": step_number,
                        "tool_name": observation["tool_name"],
                        "quality_status": observation.get("quality_status"),
                        "confidence": observation.get("confidence"),
                        "fallback_used": observation.get("fallback_used", False),
                        "native_tool": True,
                    },
                )
                yield {
                    "type": "observation",
                    "result": observation,
                    "step_number": step_number,
                    "trace_id": trace_id,
                    "native_tool": True,
                }
                await asyncio.sleep(0.05)

            final_step_number = step_number + 1
            self._record_step(
                final_step_number,
                "final_answer",
                native_result["answer"],
                {
                    "trace_id": trace_id,
                    "step_id": final_step_number,
                    "quality_status": native_result.get("quality_status"),
                    "confidence": native_result.get("confidence"),
                    "evidence": native_result.get("evidence", []),
                    "fallback_used": native_result.get("fallback_used", False),
                    "native_tool": True,
                },
            )
            AgentRepository.update_session_status(self.db, self.session_id, "completed")
            yield {
                "type": "final_answer",
                "content": native_result["answer"],
                "step_number": final_step_number,
                "trace_id": trace_id,
                "quality_status": native_result.get("quality_status"),
                "confidence": native_result.get("confidence"),
                "evidence": native_result.get("evidence", []),
                "fallback_used": native_result.get("fallback_used", False),
            }
            yield {
                "type": "completed",
                "trace_id": trace_id,
                "quality_status": native_result.get("quality_status"),
                "confidence": native_result.get("confidence"),
                "fallback_used": native_result.get("fallback_used", False),
            }
            return

        plan = self._build_plan_from_semantic_route(actual_goal, semantic_route) or self.planner.plan(actual_goal)
        trace_id = plan["trace_id"]
        step_number = base_step
        self._record_step(step_number, "goal", actual_goal, {"trace_id": trace_id, "step_id": step_number})
        yield {"type": "goal", "content": actual_goal, "step_number": step_number, "trace_id": trace_id}
        await asyncio.sleep(0.05)
        step_number += 1

        self._record_step(
            step_number,
            "thought",
            plan["rationale"],
            {"trace_id": trace_id, "step_id": step_number, "quality_status": plan["quality_status"], "confidence": plan["confidence"]},
        )
        yield {
            "type": "thought",
            "content": plan["rationale"],
            "step_number": step_number,
            "trace_id": trace_id,
            "quality_status": plan["quality_status"],
            "confidence": plan["confidence"],
        }
        await asyncio.sleep(0.05)

        observations: List[Dict[str, Any]] = []
        previous_output: Dict[str, Any] = {}
        for tool_step in plan["tool_steps"]:
            step_number += 1
            resolved_input = self._resolve_dynamic_input(tool_step["tool_input"], previous_output)
            yield {
                "type": "action",
                "tool_name": tool_step["tool_name"],
                "tool_input": resolved_input,
                "step_number": step_number,
                "trace_id": trace_id,
            }
            observation = await self._execute_tool_step(trace_id, step_number, tool_step["tool_name"], resolved_input)
            observations.append(observation)
            previous_output = {**previous_output, **observation}
            yield {
                "type": "observation",
                "result": observation,
                "step_number": step_number + 1,
                "trace_id": trace_id,
            }
            await asyncio.sleep(0.05)
            step_number += 1

            if self._should_add_supplemental_web_search(actual_goal, observation, observations):
                supplemental_input = {
                    "query": AgentPlanner._build_context_aware_query(actual_goal),
                    "max_results": 5,
                }
                yield {
                    "type": "action",
                    "tool_name": "web_search",
                    "tool_input": supplemental_input,
                    "step_number": step_number,
                    "trace_id": trace_id,
                }
                supplemental_observation = await self._execute_tool_step(
                    trace_id,
                    step_number,
                    "web_search",
                    supplemental_input,
                )
                observations.append(supplemental_observation)
                previous_output = {**previous_output, **supplemental_observation}
                yield {
                    "type": "observation",
                    "result": supplemental_observation,
                    "step_number": step_number + 1,
                    "trace_id": trace_id,
                }
                await asyncio.sleep(0.05)
                step_number += 1

        review = self.reviewer.review(plan, observations)
        final_answer = await self._build_final_answer_async(actual_goal, plan, observations, review)
        review["fallback_used"] = review.get("fallback_used", False) or self.final_answer_fallback_used
        self._record_step(
            step_number + 1,
            "final_answer",
            final_answer,
            {
                "trace_id": trace_id,
                "step_id": step_number + 1,
                "quality_status": review["quality_status"],
                "confidence": review["confidence"],
                "evidence": review.get("evidence", []),
                "fallback_used": review.get("fallback_used", False),
            },
        )
        AgentRepository.update_session_status(self.db, self.session_id, "completed")
        yield {
            "type": "final_answer",
            "content": final_answer,
            "step_number": step_number + 1,
            "trace_id": trace_id,
            "quality_status": review["quality_status"],
            "confidence": review["confidence"],
            "evidence": review.get("evidence", []),
            "fallback_used": review.get("fallback_used", False),
        }
        yield {
            "type": "completed",
            "trace_id": trace_id,
            "quality_status": review["quality_status"],
            "confidence": review["confidence"],
            "fallback_used": review.get("fallback_used", False),
        }

    async def execute_cot(self, goal: str) -> Dict[str, Any]:
        try:
            actual_goal = self._augment_goal_with_file_hints(self._build_conversation_goal(goal))
            base_step = self._next_step_number()
            if self._has_image_attachments():
                result = await self._execute_multimodal_direct(actual_goal, "cot")
                self._record_step(base_step, "goal", actual_goal, {})
                self._record_step(base_step + 1, "final_answer", result["answer"], {})
                AgentRepository.update_session_status(self.db, self.session_id, "completed")
                return {**result, "iterations": 1}
            result = await AIService.call_ai_async(
                user_prompt=f"请逐步分析并回答：{actual_goal}",
                system_prompt_name="system_prompt",
                temperature=0.3,
                max_tokens=settings.AI_DEFAULT_MAX_TOKENS,
                provider=self.agent_provider,
            )
            answer = result.get("text", "")
            self._record_step(base_step, "goal", actual_goal, {})
            self._record_step(base_step + 1, "final_answer", answer, {})
            AgentRepository.update_session_status(self.db, self.session_id, "completed")
            return {"success": True, "answer": answer, "iterations": 1}
        except Exception as exc:
            AgentRepository.update_session_status(self.db, self.session_id, "failed")
            return {"success": False, "error": str(exc)}

    @staticmethod
    def _parse_native_tool_arguments(arguments: Any) -> Dict[str, Any]:
        if arguments is None:
            return {}
        if isinstance(arguments, dict):
            return arguments
        if isinstance(arguments, str):
            payload = arguments.strip()
            if not payload:
                return {}
            parsed = json.loads(payload)
            if not isinstance(parsed, dict):
                raise ValueError("Function calling 参数必须为对象")
            return parsed
        raise ValueError("不支持的 function calling 参数格式")

    def _extract_native_tool_steps(self, tool_calls: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        steps: List[Dict[str, Any]] = []
        for tool_call in tool_calls or []:
            function_payload = tool_call.get("function") if isinstance(tool_call, dict) else None
            tool_name = (
                (function_payload or {}).get("name")
                or (tool_call.get("name") if isinstance(tool_call, dict) else None)
                or (tool_call.get("tool_name") if isinstance(tool_call, dict) else None)
            )
            if not tool_name:
                continue
            raw_arguments = (
                (function_payload or {}).get("arguments")
                if function_payload
                else tool_call.get("arguments")
            )
            steps.append(
                {
                    "tool_name": tool_name,
                    "tool_input": self._parse_native_tool_arguments(raw_arguments),
                    "reason": "模型原生 function calling 选出的工具",
                }
            )
        return steps

    async def execute_function_calling(self, goal: str) -> Dict[str, Any]:
        tools = [tool.to_openai_tool() for tool in self.tool_registry.get_structured_tools()]
        actual_goal = goal

        try:
            actual_goal = self._augment_goal_with_file_hints(self._build_conversation_goal(goal))
            base_step = self._next_step_number()
            if self._has_image_attachments():
                result = await self._execute_multimodal_direct(actual_goal, "function_calling")
                self._record_step(base_step, "goal", actual_goal, {})
                self._record_step(base_step + 1, "final_answer", result["answer"], {})
                AgentRepository.update_session_status(self.db, self.session_id, "completed")
                return {**result, "iterations": 1}
            native_result = await AIService.call_ai_with_tools_async(
                user_prompt=actual_goal,
                tools=tools,
                system_prompt_name="system_prompt",
                temperature=0.2,
                max_tokens=settings.AI_DEFAULT_MAX_TOKENS,
                quality_context={"mode": "function_calling"},
                provider=self.agent_provider,
            )
            trace_id = native_result["trace_id"]
            tool_steps = self._extract_native_tool_steps(native_result.get("tool_calls", []))

            if not tool_steps:
                answer = native_result.get("text", "").strip()
                if not answer:
                    raise ValueError("原生 function calling 未返回可执行工具")

                self._record_step(base_step, "goal", actual_goal, {"trace_id": trace_id, "step_id": base_step})
                self._record_step(
                    base_step + 1,
                    "thought",
                    "模型已直接返回最终答案，无需继续调用工具。",
                    {
                        "trace_id": trace_id,
                        "step_id": base_step + 1,
                        "quality_status": native_result.get("quality_status"),
                        "confidence": native_result.get("confidence"),
                    },
                )
                self._record_step(
                    base_step + 2,
                    "final_answer",
                    answer,
                    {
                        "trace_id": trace_id,
                        "step_id": base_step + 2,
                        "quality_status": native_result.get("quality_status"),
                        "confidence": native_result.get("confidence"),
                        "fallback_used": native_result.get("fallback_used", False),
                    },
                )
                AgentRepository.update_session_status(self.db, self.session_id, "completed")
                return {
                    "success": True,
                    "answer": answer,
                    "iterations": 0,
                    "trace_id": trace_id,
                    "quality_status": native_result.get("quality_status", "pass"),
                    "confidence": native_result.get("confidence", 0.8),
                    "evidence": native_result.get("evidence", []),
                    "fallback_used": native_result.get("fallback_used", False),
                }

            plan = {
                "trace_id": trace_id,
                "quality_status": "planned",
                "confidence": native_result.get("confidence", 0.88),
                "rationale": "优先尝试模型原生 function calling 选择工具，失败时再回退到结构化执行器。",
                "tool_steps": tool_steps,
            }

            step_number = base_step
            self._record_step(step_number, "goal", actual_goal, {"trace_id": trace_id, "step_id": step_number})
            step_number += 1
            self._record_step(
                step_number,
                "thought",
                plan["rationale"],
                {
                    "trace_id": trace_id,
                    "step_id": step_number,
                    "quality_status": plan["quality_status"],
                    "confidence": plan["confidence"],
                },
            )

            observations: List[Dict[str, Any]] = []
            previous_output: Dict[str, Any] = {}
            for tool_step in plan["tool_steps"]:
                step_number += 1
                resolved_input = self._resolve_dynamic_input(tool_step["tool_input"], previous_output)
                observation = await self._execute_tool_step(
                    trace_id=trace_id,
                    step_number=step_number,
                    tool_name=tool_step["tool_name"],
                    tool_input=resolved_input,
                )
                observations.append(observation)
                previous_output = {**previous_output, **observation}
                step_number += 1

            review = self.reviewer.review(plan, observations)
            review["fallback_used"] = review.get("fallback_used", False) or native_result.get("fallback_used", False)
            final_answer = await self._build_final_answer_async(actual_goal, plan, observations, review)
            review["fallback_used"] = review.get("fallback_used", False) or self.final_answer_fallback_used
            final_step_number = step_number + 1
            self._record_step(
                final_step_number,
                "final_answer",
                final_answer,
                {
                    "trace_id": trace_id,
                    "step_id": final_step_number,
                    "quality_status": review["quality_status"],
                    "confidence": review["confidence"],
                    "evidence": review.get("evidence", []),
                    "fallback_used": review.get("fallback_used", False),
                },
            )
            AgentRepository.update_session_status(self.db, self.session_id, "completed")
            return {
                "success": True,
                "answer": final_answer,
                "iterations": len(observations),
                "trace_id": trace_id,
                "quality_status": review["quality_status"],
                "confidence": review["confidence"],
                "evidence": review.get("evidence", []),
                "fallback_used": review.get("fallback_used", False),
            }
        except Exception as exc:
            logger.warning("原生 Function Calling 不可用，回退到结构化执行器: %s", exc)
            return await self.execute_react(actual_goal)
