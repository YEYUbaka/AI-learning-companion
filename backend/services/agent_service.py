"""
Agent service helpers.
"""
from __future__ import annotations

import json
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from core.logger import logger
from repositories.agent_repo import AgentRepository
from services.agent_executor import AgentExecutor


class AgentService:
    """Agent service."""

    def __init__(self, db: Session):
        self.db = db
        self.repo = AgentRepository()

    @staticmethod
    def _serialize_step(step: Any) -> Dict[str, Any]:
        return {
            "step_number": step.step_number,
            "step_type": step.step_type,
            "content": step.content,
            "extra_data": step.extra_data or {},
            "created_at": step.created_at.isoformat() if step.created_at else None,
        }

    @staticmethod
    def _serialize_tool_call(call: Any) -> Dict[str, Any]:
        return {
            "tool_name": call.tool_name,
            "status": call.status,
            "execution_time_ms": call.execution_time_ms,
            "input_params": call.input_params,
            "output_result": call.output_result,
            "error_message": call.error_message,
        }

    @staticmethod
    def _build_user_message_id(turn_index: int) -> str:
        return f"user-{turn_index}"

    @staticmethod
    def _build_assistant_message_id(turn_index: int) -> str:
        return f"assistant-{turn_index}"

    def _get_next_turn_index(self, session_id: int) -> int:
        steps = self.repo.get_session_steps(self.db, session_id)
        explicit_turns = sum(1 for step in steps if step.step_type == "user_message")
        if explicit_turns > 0:
            return explicit_turns + 1
        if steps:
            return 2
        return 1

    @staticmethod
    def _summarize_tool_output(output: Any) -> str:
        if not output:
            return ""
        if isinstance(output, str):
            return output.strip()[:240]
        for key in ("text", "summary", "answer", "error", "message"):
            value = output.get(key) if isinstance(output, dict) else None
            if isinstance(value, str) and value.strip():
                return value.strip()[:240]
        if isinstance(output, (dict, list)):
            try:
                return json.dumps(output, ensure_ascii=False)[:240]
            except TypeError:
                pass
        return str(output)[:240]

    @staticmethod
    def _extract_tool_output_payload(content: Any, extra: Dict[str, Any]) -> Any:
        for candidate in (extra.get("result"), extra.get("output_result"), content):
            if isinstance(candidate, (dict, list)):
                return candidate
            if isinstance(candidate, str):
                stripped = candidate.strip()
                if stripped.startswith("{") or stripped.startswith("["):
                    try:
                        return json.loads(stripped)
                    except json.JSONDecodeError:
                        continue
        return content

    @classmethod
    def _derive_tool_status(cls, output: Any, extra: Dict[str, Any]) -> str:
        for container in (output, extra):
            if isinstance(container, dict) and "success" in container:
                return "success" if container.get("success") else "failed"

        for container in (output, extra):
            if isinstance(container, dict):
                if container.get("error") or container.get("provider_search_error"):
                    return "failed"
                if any(
                    isinstance(container.get(key), str) and container.get(key).strip()
                    for key in ("text", "summary", "answer", "message")
                ):
                    return "success"
                if isinstance(container.get("results"), list) and container.get("results"):
                    return "success"
                if isinstance(container.get("evidence"), list) and container.get("evidence"):
                    return "success"
                if isinstance(container.get("count"), int) and container.get("count") > 0:
                    return "success"

        if isinstance(output, str) and output.strip():
            return "success"
        if isinstance(output, list) and output:
            return "success"

        return "failed"

    def _build_timeline(
        self,
        session: Any,
        steps: List[Any],
    ) -> List[Dict[str, Any]]:
        timeline: List[Dict[str, Any]] = []
        current_turn_index = 0
        current_assistant: Optional[Dict[str, Any]] = None

        def ensure_user_turn_from_legacy() -> None:
            nonlocal current_turn_index
            if current_turn_index > 0:
                return
            current_turn_index = 1
            timeline.append(
                {
                    "id": self._build_user_message_id(current_turn_index),
                    "role": "user",
                    "turn_index": current_turn_index,
                    "content": session.goal,
                    "attachments": (session.context or {}).get("attachments") or [],
                    "thinking": "",
                    "tool_uses": [],
                    "status": "completed",
                    "created_at": session.created_at.isoformat() if session.created_at else None,
                }
            )

        def ensure_assistant_turn() -> Dict[str, Any]:
            nonlocal current_assistant, current_turn_index
            if current_turn_index == 0:
                ensure_user_turn_from_legacy()
            if current_assistant and current_assistant.get("turn_index") == current_turn_index:
                return current_assistant
            current_assistant = {
                "id": self._build_assistant_message_id(current_turn_index),
                "role": "assistant",
                "turn_index": current_turn_index,
                "content": "",
                "attachments": [],
                "thinking": "",
                "tool_uses": [],
                "status": "in_progress",
                "created_at": None,
            }
            timeline.append(current_assistant)
            return current_assistant

        for step in steps:
            extra = step.extra_data or {}
            if step.step_type == "user_message":
                current_turn_index = int(extra.get("turn_index") or (current_turn_index + 1 or 1))
                current_assistant = None
                timeline.append(
                    {
                        "id": self._build_user_message_id(current_turn_index),
                        "role": "user",
                        "turn_index": current_turn_index,
                        "content": step.content,
                        "attachments": extra.get("attachments") or [],
                        "thinking": "",
                        "tool_uses": [],
                        "status": "completed",
                        "created_at": step.created_at.isoformat() if step.created_at else None,
                    }
                )
                continue

            if step.step_type == "goal":
                continue

            assistant_turn = ensure_assistant_turn()
            if not assistant_turn.get("created_at"):
                assistant_turn["created_at"] = step.created_at.isoformat() if step.created_at else None

            if step.step_type == "thought":
                thought = step.content.strip()
                assistant_turn["thinking"] = (
                    f"{assistant_turn['thinking']}\n\n{thought}".strip()
                    if assistant_turn["thinking"]
                    else thought
                )
                continue

            if step.step_type == "action":
                assistant_turn["tool_uses"].append(
                    {
                        "id": f"{assistant_turn['id']}-tool-{len(assistant_turn['tool_uses']) + 1}",
                        "tool_name": extra.get("tool_name") or step.content.split(":", 1)[0],
                        "input": extra.get("tool_input") or {},
                        "output": None,
                        "output_summary": "",
                        "status": "pending",
                        "created_at": step.created_at.isoformat() if step.created_at else None,
                    }
                )
                continue

            if step.step_type == "observation":
                tool_cards = assistant_turn["tool_uses"]
                output_payload = self._extract_tool_output_payload(step.content, extra)
                output_summary = self._summarize_tool_output(output_payload or extra)
                output_status = self._derive_tool_status(output_payload, extra)
                if tool_cards:
                    target = tool_cards[-1]
                    target["output"] = output_payload
                    target["output_summary"] = output_summary
                    target["status"] = output_status
                else:
                    assistant_turn["tool_uses"].append(
                        {
                            "id": f"{assistant_turn['id']}-tool-{len(tool_cards) + 1}",
                            "tool_name": extra.get("tool_name") or "tool",
                            "input": {},
                            "output": output_payload,
                            "output_summary": output_summary,
                            "status": output_status,
                            "created_at": step.created_at.isoformat() if step.created_at else None,
                        }
                    )
                continue

            if step.step_type == "final_answer":
                assistant_turn["content"] = step.content
                assistant_turn["status"] = "completed"
                assistant_turn["quality_status"] = extra.get("quality_status")
                assistant_turn["confidence"] = extra.get("confidence")
                assistant_turn["evidence"] = extra.get("evidence", [])
                assistant_turn["fallback_used"] = extra.get("fallback_used", False)

        if current_assistant and current_assistant.get("status") != "completed":
            current_assistant["status"] = "completed" if session.status == "completed" else session.status

        return timeline

    def _derive_session_title(self, session: Any, steps: List[Any]) -> str:
        for step in steps:
            if step.step_type == "user_message" and step.content:
                return step.content.strip()[:80]
        return (session.goal or "").strip()[:80]

    def create_or_resume_session(
        self,
        *,
        user_id: int,
        message: str,
        mode: str = "react",
        context: Optional[Dict[str, Any]] = None,
        session_id: Optional[int] = None,
    ) -> Tuple[Any, str, int]:
        attachments = (context or {}).get("attachments") or []

        if session_id:
            session = self.repo.get_session_for_user(self.db, session_id, user_id)
            if not session:
                raise ValueError("会话不存在或无权限访问")
            self.repo.resume_session(self.db, session.id, session_type=mode)
            event_type = "session_resumed"
        else:
            session = self.repo.create_session(
                db=self.db,
                user_id=user_id,
                session_type=mode,
                goal=message,
                context=context,
            )
            event_type = "session_created"

        turn_index = self._get_next_turn_index(session.id)
        step_number = self.repo.get_next_step_number(self.db, session.id)
        self.repo.add_step(
            self.db,
            session_id=session.id,
            step_number=step_number,
            step_type="user_message",
            content=message,
            extra_data={
                "attachments": attachments,
                "turn_index": turn_index,
            },
        )
        return session, event_type, turn_index

    async def create_and_execute_task(
        self,
        user_id: int,
        goal: str,
        mode: str = "react",
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        try:
            session, _, _ = self.create_or_resume_session(
                user_id=user_id,
                message=goal,
                mode=mode,
                context=context,
            )

            logger.info("创建 Agent 会话: %s, 模式: %s", session.id, mode)

            executor = AgentExecutor(self.db, user_id, session.id, context=context)
            if mode == "react":
                result = await executor.execute_react(goal)
            elif mode == "cot":
                result = await executor.execute_cot(goal)
            elif mode == "function_calling":
                result = await executor.execute_function_calling(goal)
            else:
                result = {
                    "success": False,
                    "error": f"不支持的模式: {mode}",
                }

            return {
                "session_id": session.id,
                "result": result,
            }
        except Exception as exc:
            logger.error("执行 Agent 任务失败: %s", exc)
            return {
                "success": False,
                "error": str(exc),
            }

    def get_session_history(
        self,
        session_id: int,
        user_id: Optional[int] = None,
    ) -> Optional[Dict[str, Any]]:
        try:
            session = (
                self.repo.get_session_for_user(self.db, session_id, user_id)
                if user_id is not None
                else self.repo.get_session(self.db, session_id)
            )
            if not session:
                return None

            steps = self.repo.get_session_steps(self.db, session_id)
            tool_calls = self.repo.get_session_tool_calls(self.db, session_id)
            timeline = self._build_timeline(session, steps)
            title = self._derive_session_title(session, steps)

            return {
                "session_id": session.id,
                "goal": session.goal,
                "title": title,
                "status": session.status,
                "session_type": session.session_type,
                "context": session.context or {},
                "created_at": session.created_at.isoformat() if session.created_at else None,
                "updated_at": session.updated_at.isoformat() if session.updated_at else None,
                "completed_at": session.completed_at.isoformat() if session.completed_at else None,
                "steps": [self._serialize_step(step) for step in steps],
                "tool_calls": [self._serialize_tool_call(call) for call in tool_calls],
                "timeline": timeline,
            }
        except Exception as exc:
            logger.error("获取会话历史失败: %s", exc)
            return None

    def get_user_sessions(
        self,
        user_id: int,
        limit: int = 20,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        try:
            sessions = self.repo.get_user_sessions(self.db, user_id, limit, offset)
            result: List[Dict[str, Any]] = []
            for session in sessions:
                steps = self.repo.get_session_steps(self.db, session.id)
                result.append(
                    {
                        "session_id": session.id,
                        "goal": session.goal,
                        "title": self._derive_session_title(session, steps),
                        "status": session.status,
                        "session_type": session.session_type,
                        "created_at": session.created_at.isoformat() if session.created_at else None,
                        "updated_at": session.updated_at.isoformat() if session.updated_at else None,
                    }
                )
            return result
        except Exception as exc:
            logger.error("获取用户会话列表失败: %s", exc)
            return []

    async def execute_task_stream(
        self,
        user_id: int,
        session_id: int,
        goal: str,
        mode: str = "react",
        context: Optional[Dict[str, Any]] = None,
        turn_index: Optional[int] = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        try:
            logger.info(
                "开始流式执行任务: session_id=%s, mode=%s",
                session_id,
                mode,
            )

            executor = AgentExecutor(self.db, user_id, session_id, context=context)
            if mode == "react":
                async for event in executor.execute_react_stream(goal):
                    yield event
                if turn_index is not None:
                    yield {"type": "assistant_turn_completed", "turn_index": turn_index}
                return

            if mode == "cot":
                yield {
                    "type": "iteration_start",
                    "iteration": 1,
                    "max_iterations": 1,
                    "message": "开始逐步思考...",
                }
                result = await executor.execute_cot(goal)
                if result.get("success") and result.get("answer"):
                    yield {
                        "type": "final_answer",
                        "content": result.get("answer", ""),
                        "step_number": 1,
                    }
                if turn_index is not None:
                    yield {"type": "assistant_turn_completed", "turn_index": turn_index}
                yield {
                    "type": "completed" if result.get("success") else "failed",
                    "result": result,
                }
                return

            if mode == "function_calling":
                yield {
                    "type": "iteration_start",
                    "iteration": 1,
                    "max_iterations": 1,
                    "message": "开始调用工具...",
                }
                result = await executor.execute_function_calling(goal)
                if result.get("success") and result.get("answer"):
                    yield {
                        "type": "final_answer",
                        "content": result.get("answer", ""),
                        "step_number": 1,
                    }
                if turn_index is not None:
                    yield {"type": "assistant_turn_completed", "turn_index": turn_index}
                yield {
                    "type": "completed" if result.get("success") else "failed",
                    "result": result,
                }
                return

            yield {
                "type": "error",
                "error": f"不支持的模式: {mode}",
            }
        except Exception as exc:
            logger.error("流式执行任务失败: %s", exc)
            yield {
                "type": "error",
                "error": str(exc),
            }
