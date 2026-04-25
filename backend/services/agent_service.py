"""
Agent 服务层
"""
from typing import Any, AsyncGenerator, Dict, List, Optional

from sqlalchemy.orm import Session

from core.logger import logger
from repositories.agent_repo import AgentRepository
from services.agent_executor import AgentExecutor


class AgentService:
    """Agent 服务"""

    def __init__(self, db: Session):
        self.db = db
        self.repo = AgentRepository()

    async def create_and_execute_task(
        self,
        user_id: int,
        goal: str,
        mode: str = "react",
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        try:
            session = self.repo.create_session(
                db=self.db,
                user_id=user_id,
                session_type=mode,
                goal=goal,
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

    def get_session_history(self, session_id: int) -> Optional[Dict[str, Any]]:
        try:
            session = self.repo.get_session(self.db, session_id)
            if not session:
                return None

            steps = self.repo.get_session_steps(self.db, session_id)
            tool_calls = self.repo.get_session_tool_calls(self.db, session_id)

            return {
                "session_id": session.id,
                "goal": session.goal,
                "status": session.status,
                "session_type": session.session_type,
                "context": session.context or {},
                "created_at": (
                    session.created_at.isoformat() if session.created_at else None
                ),
                "completed_at": (
                    session.completed_at.isoformat()
                    if session.completed_at
                    else None
                ),
                "steps": [
                    {
                        "step_number": step.step_number,
                        "step_type": step.step_type,
                        "content": step.content,
                        "extra_data": step.extra_data or {},
                        "created_at": (
                            step.created_at.isoformat()
                            if step.created_at
                            else None
                        ),
                    }
                    for step in steps
                ],
                "tool_calls": [
                    {
                        "tool_name": call.tool_name,
                        "status": call.status,
                        "execution_time_ms": call.execution_time_ms,
                        "input_params": call.input_params,
                        "output_result": call.output_result,
                        "error_message": call.error_message,
                    }
                    for call in tool_calls
                ],
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
            sessions = self.repo.get_user_sessions(
                self.db, user_id, limit, offset
            )
            return [
                {
                    "session_id": session.id,
                    "goal": session.goal,
                    "status": session.status,
                    "session_type": session.session_type,
                    "created_at": (
                        session.created_at.isoformat()
                        if session.created_at
                        else None
                    ),
                }
                for session in sessions
            ]
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
                yield {
                    "type": "completed"
                    if result.get("success")
                    else "failed",
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
                yield {
                    "type": "completed"
                    if result.get("success")
                    else "failed",
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
