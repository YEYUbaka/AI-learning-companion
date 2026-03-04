"""
聊天记录相关路由
支持保存和加载用户的AI对话历史
"""
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc
from database import get_db
from core.security import get_current_user
from models.users import User
from models.chat_sessions import ChatSession, ChatMessage
from datetime import datetime

router = APIRouter(prefix="/api/v1/chat", tags=["聊天记录"])


# 请求/响应模型
class MessageSchema(BaseModel):
    """消息模型"""
    role: str  # "user" 或 "ai"
    content: str
    provider: Optional[str] = None  # AI模型提供商（仅AI消息）

    class Config:
        from_attributes = True


class ChatSessionSchema(BaseModel):
    """聊天会话模型"""
    id: Optional[int] = None
    title: str
    createdAt: str
    messages: List[MessageSchema] = []

    class Config:
        from_attributes = True


class ChatSessionListResponse(BaseModel):
    """会话列表响应"""
    sessions: List[ChatSessionSchema]


class ChatSessionResponse(BaseModel):
    """单个会话响应"""
    session: ChatSessionSchema


class CreateSessionRequest(BaseModel):
    """创建会话请求"""
    title: Optional[str] = "新的对话"


class UpdateSessionRequest(BaseModel):
    """更新会话请求"""
    title: Optional[str] = None
    messages: Optional[List[MessageSchema]] = None


@router.get("/sessions", response_model=ChatSessionListResponse)
async def get_sessions(
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取当前用户的所有聊天会话
    返回最近的会话列表
    """
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.user_id == current_user.id)
        .order_by(desc(ChatSession.updated_at))
        .limit(limit)
        .all()
    )
    
    result = []
    for session in sessions:
        # 加载消息
        messages = (
            db.query(ChatMessage)
            .filter(ChatMessage.session_id == session.id)
            .order_by(ChatMessage.created_at)
            .all()
        )
        
        result.append(ChatSessionSchema(
            id=session.id,
            title=session.title,
            createdAt=session.created_at.isoformat(),
            messages=[
                MessageSchema(
                    role=msg.role,
                    content=msg.content,
                    provider=msg.provider
                )
                for msg in messages
            ]
        ))
    
    return ChatSessionListResponse(sessions=result)


@router.get("/sessions/{session_id}", response_model=ChatSessionResponse)
async def get_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取指定会话的详细信息
    """
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
        .first()
    )
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="会话不存在"
        )
    
    # 加载消息
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at)
        .all()
    )
    
    return ChatSessionResponse(
        session=ChatSessionSchema(
            id=session.id,
            title=session.title,
            createdAt=session.created_at.isoformat(),
            messages=[
                MessageSchema(
                    role=msg.role,
                    content=msg.content,
                    provider=msg.provider
                )
                for msg in messages
            ]
        )
    )


@router.post("/sessions", response_model=ChatSessionResponse)
async def create_session(
    request: CreateSessionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    创建新的聊天会话
    """
    session = ChatSession(
        user_id=current_user.id,
        title=request.title or "新的对话"
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    
    return ChatSessionResponse(
        session=ChatSessionSchema(
            id=session.id,
            title=session.title,
            createdAt=session.created_at.isoformat(),
            messages=[]
        )
    )


@router.put("/sessions/{session_id}", response_model=ChatSessionResponse)
async def update_session(
    session_id: int,
    request: UpdateSessionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    更新会话（标题或消息）
    """
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
        .first()
    )
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="会话不存在"
        )
    
    # 更新标题
    if request.title is not None:
        session.title = request.title
    
    # 更新消息
    if request.messages is not None:
        # 删除旧消息
        db.query(ChatMessage).filter(ChatMessage.session_id == session.id).delete()
        
        # 添加新消息
        for msg_data in request.messages:
            message = ChatMessage(
                session_id=session.id,
                role=msg_data.role,
                content=msg_data.content,
                provider=msg_data.provider
            )
            db.add(message)
    
    db.commit()
    db.refresh(session)
    
    # 重新加载消息
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at)
        .all()
    )
    
    return ChatSessionResponse(
        session=ChatSessionSchema(
            id=session.id,
            title=session.title,
            createdAt=session.created_at.isoformat(),
            messages=[
                MessageSchema(
                    role=msg.role,
                    content=msg.content,
                    provider=msg.provider
                )
                for msg in messages
            ]
        )
    )


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    删除会话
    """
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
        .first()
    )
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="会话不存在"
        )
    
    db.delete(session)
    db.commit()
    
    return {"success": True, "message": "会话已删除"}

