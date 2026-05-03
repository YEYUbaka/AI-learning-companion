"""
Agent API routes.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.logger import logger
from core.security import get_current_user
from database import get_db
from services.agent_service import AgentService
from utils.tool_registry import ToolRegistry


router = APIRouter(prefix="/api/agent", tags=["agent"])


class AgentTaskRequest(BaseModel):
    """Agent task request."""

    goal: Optional[str] = None
    message: Optional[str] = None
    mode: str = "react"
    context: Optional[dict] = None
    session_id: Optional[int] = None


@router.post("/task")
async def create_agent_task(
    request: AgentTaskRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Create and execute an Agent task."""
    try:
        message = (request.message or request.goal or "").strip()
        if not message:
            raise HTTPException(status_code=400, detail="message 不能为空")

        agent_service = AgentService(db)
        result = await agent_service.create_and_execute_task(
            user_id=current_user.id,
            goal=message,
            mode=request.mode,
            context=request.context,
        )
        return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("创建 Agent 任务失败: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/session/{session_id}")
async def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get Agent session detail."""
    try:
        agent_service = AgentService(db)
        session = agent_service.get_session_history(session_id, user_id=current_user.id)

        if not session:
            raise HTTPException(status_code=404, detail="会话不存在")

        return session
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("获取会话详情失败: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/sessions")
async def get_user_sessions(
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get current user's sessions."""
    try:
        agent_service = AgentService(db)
        sessions = agent_service.get_user_sessions(
            user_id=current_user.id,
            limit=limit,
            offset=offset,
        )
        return {"sessions": sessions}
    except Exception as exc:
        logger.error("获取会话列表失败: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/tools")
async def list_tools(
    current_user=Depends(get_current_user),
):
    """List available tools."""
    try:
        _ = current_user
        tool_registry = ToolRegistry()
        tools = tool_registry.list_tools()
        return {"tools": tools}
    except Exception as exc:
        logger.error("列出工具失败: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
