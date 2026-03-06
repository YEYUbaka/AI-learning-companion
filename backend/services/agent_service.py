"""
Agent 服务层 - 会话管理和任务编排
"""
from typing import Dict, Any, Optional, List, AsyncGenerator
from sqlalchemy.orm import Session
from repositories.agent_repo import AgentRepository
from services.agent_executor import AgentExecutor
from core.logger import logger


class AgentService:
    """Agent 服务"""

    def __init__(self, db: Session):
        self.db = db
        self.repo = AgentRepository()

    async def create_and_execute_task(
        self,
        user_id: int,
        goal: str,
        mode: str = "react"
    ) -> Dict[str, Any]:
        """创建并执行 Agent 任务"""
        try:
            # 创建会话
            session = self.repo.create_session(
                db=self.db,
                user_id=user_id,
                session_type=mode,
                goal=goal
            )

            logger.info(f"创建 Agent 会话: {session.id}, 模式: {mode}")

            # 创建执行器
            executor = AgentExecutor(self.db, user_id, session.id)

            # 根据模式执行
            if mode == "react":
                result = await executor.execute_react(goal)
            elif mode == "cot":
                result = await executor.execute_cot(goal)
            elif mode == "function_calling":
                result = await executor.execute_function_calling(goal)
            else:
                result = {
                    "success": False,
                    "error": f"不支持的模式: {mode}"
                }

            return {
                "session_id": session.id,
                "result": result
            }

        except Exception as e:
            logger.error(f"执行 Agent 任务失败: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    def get_session_history(self, session_id: int) -> Optional[Dict[str, Any]]:
        """获取会话历史"""
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
                "created_at": session.created_at.isoformat() if session.created_at else None,
                "completed_at": session.completed_at.isoformat() if session.completed_at else None,
                "steps": [
                    {
                        "step_number": step.step_number,
                        "step_type": step.step_type,
                        "content": step.content,
                        "created_at": step.created_at.isoformat() if step.created_at else None
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
                        "error_message": call.error_message
                    }
                    for call in tool_calls
                ]
            }

        except Exception as e:
            logger.error(f"获取会话历史失败: {str(e)}")
            return None

    def get_user_sessions(
        self,
        user_id: int,
        limit: int = 20,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """获取用户的会话列表"""
        try:
            sessions = self.repo.get_user_sessions(self.db, user_id, limit, offset)

            return [
                {
                    "session_id": session.id,
                    "goal": session.goal,
                    "status": session.status,
                    "session_type": session.session_type,
                    "created_at": session.created_at.isoformat() if session.created_at else None
                }
                for session in sessions
            ]

        except Exception as e:
            logger.error(f"获取用户会话列表失败: {str(e)}")
            return []

    async def execute_task_stream(
        self,
        user_id: int,
        session_id: int,
        goal: str,
        mode: str = "react"
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """流式执行 Agent 任务"""
        try:
            logger.info(f"开始流式执行任务: session_id={session_id}, mode={mode}")

            # 创建执行器
            executor = AgentExecutor(self.db, user_id, session_id)

            # 根据模式执行（流式）
            if mode == "react":
                async for event in executor.execute_react_stream(goal):
                    yield event
            elif mode == "cot":
                # CoT 模式暂时使用非流式，后续可优化
                result = await executor.execute_cot(goal)
                yield {
                    "type": "completed" if result.get("success") else "failed",
                    "result": result
                }
            elif mode == "function_calling":
                # Function Calling 模式暂时使用非流式，后续可优化
                result = await executor.execute_function_calling(goal)
                yield {
                    "type": "completed" if result.get("success") else "failed",
                    "result": result
                }
            else:
                yield {
                    "type": "error",
                    "error": f"不支持的模式: {mode}"
                }

        except Exception as e:
            logger.error(f"流式执行任务失败: {str(e)}")
            yield {
                "type": "error",
                "error": str(e)
            }
