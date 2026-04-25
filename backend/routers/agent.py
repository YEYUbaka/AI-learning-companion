"""
Agent API 路由
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
from core.security import get_current_user
from services.agent_service import AgentService
from utils.tool_registry import ToolRegistry
from core.logger import logger


router = APIRouter(prefix="/api/agent", tags=["agent"])


class AgentTaskRequest(BaseModel):
    """Agent 任务请求"""
    goal: str
    mode: str = "react"  # react, cot, function_calling
    context: Optional[dict] = None


@router.post("/task")
async def create_agent_task(
    request: AgentTaskRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """创建并执行 Agent 任务"""
    try:
        agent_service = AgentService(db)
        result = await agent_service.create_and_execute_task(
            user_id=current_user.id,
            goal=request.goal,
            mode=request.mode,
            context=request.context,
        )

        return result

    except Exception as e:
        logger.error(f"创建 Agent 任务失败: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/{session_id}")
async def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """获取 Agent 会话详情"""
    try:
        agent_service = AgentService(db)
        session = agent_service.get_session_history(session_id)

        if not session:
            raise HTTPException(status_code=404, detail="会话不存在")

        return session

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取会话详情失败: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions")
async def get_user_sessions(
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """获取用户的会话列表"""
    try:
        agent_service = AgentService(db)
        sessions = agent_service.get_user_sessions(
            user_id=current_user.id,
            limit=limit,
            offset=offset
        )

        return {"sessions": sessions}

    except Exception as e:
        logger.error(f"获取会话列表失败: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tools")
async def list_tools(
    current_user = Depends(get_current_user)
):
    """列出可用工具"""
    try:
        tool_registry = ToolRegistry()
        tools = tool_registry.list_tools()

        return {"tools": tools}

    except Exception as e:
        logger.error(f"列出工具失败: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
