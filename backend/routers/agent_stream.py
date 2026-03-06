"""
Agent 流式输出路由 - 使用 SSE (Server-Sent Events)
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import json
import asyncio

from database import get_db
from core.security import get_current_user
from services.agent_service import AgentService
from repositories.agent_repo import AgentRepository
from core.logger import logger


router = APIRouter(prefix="/api/agent", tags=["agent-stream"])


class AgentTaskStreamRequest(BaseModel):
    """Agent 任务流式请求"""
    goal: str
    mode: str = "react"
    context: Optional[dict] = None


@router.post("/task/stream")
async def create_agent_task_stream(
    request: AgentTaskStreamRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """流式执行 Agent 任务"""

    async def event_generator():
        try:
            user_id = current_user.id

            # 创建会话
            session = AgentRepository.create_session(
                db,
                user_id=user_id,
                session_type=request.mode,
                goal=request.goal,
                context=request.context
            )

            # 推送会话创建事件
            yield f"data: {json.dumps({'type': 'session_created', 'session_id': session.id}, ensure_ascii=False)}\n\n"

            # 执行 Agent 任务（流式）
            agent_service = AgentService(db)
            async for event in agent_service.execute_task_stream(user_id, session.id, request.goal, request.mode):
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
                await asyncio.sleep(0.01)  # 避免过快推送

            # 推送完成事件
            yield "data: [DONE]\n\n"

        except Exception as e:
            logger.error(f"流式任务执行失败: {str(e)}")
            error_event = {
                "type": "error",
                "error": str(e)
            }
            yield f"data: {json.dumps(error_event, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # 禁用 Nginx 缓冲
        }
    )
