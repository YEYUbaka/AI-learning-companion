"""
Agent 执行引擎
"""
import asyncio
import json
import re
from typing import Any, AsyncGenerator, Dict, List
from uuid import uuid4

from sqlalchemy.orm import Session

from core.config import settings
from core.logger import logger
from repositories.agent_repo import AgentRepository
from services.ai_service import AIService
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


class AgentPlanner:
    """结构化规划器"""

    def __init__(self, tool_registry: ToolRegistry):
        self.tool_registry = tool_registry

    def plan(self, goal: str) -> Dict[str, Any]:
        goal_text = (goal or "").strip()
        lower_goal = goal_text.lower()
        trace_id = str(uuid4())
        tool_steps: List[Dict[str, Any]] = []
        rationale = "根据用户意图进行结构化工具规划。"
        confidence = 0.76

        if any(keyword in goal_text for keyword in ["试卷", "组卷", "教师卷", "练习卷"]):
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
        elif any(keyword in goal_text for keyword in ["知识图谱", "思维导图", "XMind", "xmind"]):
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
        elif any(keyword in goal_text for keyword in EDUCATION_EVIDENCE_KEYWORDS):
            tool_steps.append(
                {
                    "tool_name": "search_knowledge",
                    "tool_input": {"query": goal_text, "limit": 5},
                    "reason": "教育类问答优先检索知识库证据",
                }
            )
            if any(keyword in goal_text for keyword in ["例题", "真题", "题"]):
                tool_steps.append(
                    {
                        "tool_name": "search_example_questions",
                        "tool_input": {"query": goal_text, "limit": 3},
                        "reason": "补充例题/真题素材",
                    }
                )
            rationale = "检测到教育类知识问答，先检索知识库，再补充样题证据。"
            confidence = 0.87
        elif any(keyword in goal_text for keyword in ["学习计划", "学习路线", "怎么学"]):
            tool_steps = [
                {
                    "tool_name": "generate_study_plan",
                    "tool_input": {"goal": goal_text, "duration_days": 14},
                    "reason": "根据目标生成学习计划",
                }
            ]
            rationale = "检测到学习计划意图，直接生成学习计划。"
            confidence = 0.82
        elif any(keyword in goal_text for keyword in ["搜索", "查找", "搜一下", "最新"]):
            tool_steps = [
                {
                    "tool_name": "web_search",
                    "tool_input": {"query": goal_text, "max_results": 5},
                    "reason": "需要联网检索最新信息",
                }
            ]
            rationale = "检测到搜索意图，直接使用网络检索。"
            confidence = 0.72
        else:
            tool_steps = [
                {
                    "tool_name": "search_knowledge",
                    "tool_input": {"query": goal_text, "limit": 5},
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

    def __init__(self, db: Session, user_id: int, session_id: int):
        self.db = db
        self.user_id = user_id
        self.session_id = session_id
        self.tool_registry = ToolRegistry()
        self.planner = AgentPlanner(self.tool_registry)
        self.reviewer = AgentReviewer()

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

    def _resolve_dynamic_input(self, tool_input: Dict[str, Any], previous_output: Dict[str, Any]) -> Dict[str, Any]:
        resolved = {}
        for key, value in tool_input.items():
            if isinstance(value, str) and value.startswith("__from_previous__."):
                resolved[key] = previous_output.get(value.split(".", 1)[1])
            else:
                resolved[key] = value
        return resolved

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
        sections = [f"## 任务目标\n{goal}"]

        if observations and observations[-1].get("blueprint"):
            blueprint = observations[-1]["blueprint"]
            sections.append(
                "## 试卷蓝图\n"
                f"- 模式：{blueprint['mode']}\n"
                f"- 总题数：{blueprint['total_questions']}\n"
                f"- 知识点：{', '.join(blueprint.get('knowledge_points') or ['综合能力'])}"
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
                "## 审核结果\n"
                f"- 质量状态：{quality_report.get('quality_status')}\n"
                f"- 质量分：{quality_report.get('score')}\n"
                f"- 重复率：{quality_report.get('duplicate_rate')}\n"
                f"- 覆盖知识点：{', '.join(quality_report.get('coverage_knowledge_points') or [])}"
            )
        elif generated_questions:
            preview = []
            for question in generated_questions[:3]:
                preview.append(f"- {question.get('question_id')}: {question.get('stem')}")
            sections.append("## 题目预览\n" + "\n".join(preview))
        else:
            evidence_lines = []
            for evidence in review.get("evidence", [])[:5]:
                line = evidence.get("summary") or evidence.get("excerpt") or "证据"
                evidence_lines.append(f"- {line}")
            if evidence_lines:
                sections.append("## 证据摘要\n" + "\n".join(evidence_lines))

        sections.append(
            "## 质量标记\n"
            f"- quality_status: {review.get('quality_status')}\n"
            f"- confidence: {round(review.get('confidence', 0), 2)}\n"
            f"- fallback_used: {'是' if review.get('fallback_used') else '否'}"
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
你是智学伴的结构化教育助手。请基于工具证据生成最终回答。

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
        try:
            result = AIService.call_ai(
                db=self.db,
                user_prompt=prompt,
                system_prompt_name="system_prompt",
                temperature=0.2,
                max_tokens=settings.AI_DEFAULT_MAX_TOKENS,
            )
            text = result.get("text", "").strip()
            if text:
                return text
        except Exception as exc:
            logger.warning("最终答案 AI 生成失败，回退到模板拼装: %s", exc)
        return self._build_final_answer_fallback(goal, plan, observations, review)

    async def _build_final_answer_async(
        self,
        goal: str,
        plan: Dict[str, Any],
        observations: List[Dict[str, Any]],
        review: Dict[str, Any],
    ) -> str:
        prompt = self._build_final_answer_prompt(goal, plan, observations, review)
        try:
            result = await AIService.call_ai_async(
                user_prompt=prompt,
                system_prompt_name="system_prompt",
                temperature=0.2,
                max_tokens=settings.AI_DEFAULT_MAX_TOKENS,
            )
            text = result.get("text", "").strip()
            if text:
                return text
        except Exception as exc:
            logger.warning("最终答案 AI 生成失败，回退到模板拼装: %s", exc)
        return self._build_final_answer_fallback(goal, plan, observations, review)

    async def execute_react(self, goal: str) -> Dict[str, Any]:
        try:
            plan = self.planner.plan(goal)
            trace_id = plan["trace_id"]
            step_number = 0
            self._record_step(step_number, "goal", goal, {"trace_id": trace_id, "step_id": step_number})
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
            final_answer = await self._build_final_answer_async(goal, plan, observations, review)
            self._record_step(
                step_number,
                "final_answer",
                final_answer,
                {
                    "trace_id": trace_id,
                    "step_id": step_number,
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
        plan = self.planner.plan(goal)
        trace_id = plan["trace_id"]
        step_number = 0
        self._record_step(step_number, "goal", goal, {"trace_id": trace_id, "step_id": step_number})
        yield {"type": "goal", "content": goal, "step_number": step_number, "trace_id": trace_id}
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

        review = self.reviewer.review(plan, observations)
        final_answer = await self._build_final_answer_async(goal, plan, observations, review)
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
            result = await AIService.call_ai_async(
                user_prompt=f"请逐步分析并回答：{goal}",
                system_prompt_name="system_prompt",
                temperature=0.3,
                max_tokens=settings.AI_DEFAULT_MAX_TOKENS,
            )
            answer = result.get("text", "")
            self._record_step(0, "goal", goal, {})
            self._record_step(1, "final_answer", answer, {})
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

        try:
            native_result = await AIService.call_ai_with_tools_async(
                user_prompt=goal,
                tools=tools,
                system_prompt_name="system_prompt",
                temperature=0.2,
                max_tokens=settings.AI_DEFAULT_MAX_TOKENS,
                quality_context={"mode": "function_calling"},
            )
            trace_id = native_result["trace_id"]
            tool_steps = self._extract_native_tool_steps(native_result.get("tool_calls", []))

            if not tool_steps:
                answer = native_result.get("text", "").strip()
                if not answer:
                    raise ValueError("原生 function calling 未返回可执行工具")

                self._record_step(0, "goal", goal, {"trace_id": trace_id, "step_id": 0})
                self._record_step(
                    1,
                    "thought",
                    "模型已直接返回最终答案，无需继续调用工具。",
                    {
                        "trace_id": trace_id,
                        "step_id": 1,
                        "quality_status": native_result.get("quality_status"),
                        "confidence": native_result.get("confidence"),
                    },
                )
                self._record_step(
                    2,
                    "final_answer",
                    answer,
                    {
                        "trace_id": trace_id,
                        "step_id": 2,
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

            step_number = 0
            self._record_step(step_number, "goal", goal, {"trace_id": trace_id, "step_id": step_number})
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
            final_answer = await self._build_final_answer_async(goal, plan, observations, review)
            self._record_step(
                step_number,
                "final_answer",
                final_answer,
                {
                    "trace_id": trace_id,
                    "step_id": step_number,
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
            return await self.execute_react(goal)
