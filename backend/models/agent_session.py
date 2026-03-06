"""
Agent 会话相关的数据库模型
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class AgentSession(Base):
    """Agent 会话表"""
    __tablename__ = "agent_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_type = Column(String(50), nullable=False)  # react, cot, function_calling
    goal = Column(Text, nullable=False)  # 用户目标
    status = Column(String(20), default="running")  # running, completed, failed
    context = Column(JSON, default={})  # 会话上下文
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # 关系
    user = relationship("User", back_populates="agent_sessions")
    steps = relationship("AgentStep", back_populates="session", cascade="all, delete-orphan")
    tool_calls = relationship("AgentToolCall", back_populates="session", cascade="all, delete-orphan")


class AgentStep(Base):
    """Agent 执行步骤表"""
    __tablename__ = "agent_steps"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("agent_sessions.id"), nullable=False)
    step_number = Column(Integer, nullable=False)  # 步骤序号
    step_type = Column(String(30), nullable=False)  # thought, action, observation, final_answer
    content = Column(Text, nullable=False)  # 步骤内容
    extra_data = Column(JSON, default={})  # 额外信息（token 使用量等）- 改名避免与 metadata 冲突
    created_at = Column(DateTime, default=datetime.utcnow)

    # 关系
    session = relationship("AgentSession", back_populates="steps")


class AgentToolCall(Base):
    """工具调用记录表"""
    __tablename__ = "agent_tool_calls"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("agent_sessions.id"), nullable=False)
    step_id = Column(Integer, nullable=True)
    tool_name = Column(String(100), nullable=False)
    input_params = Column(JSON, nullable=False)
    output_result = Column(JSON, nullable=True)
    status = Column(String(20), default="pending")  # pending, success, failed
    error_message = Column(Text, nullable=True)
    execution_time_ms = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    # 关系
    session = relationship("AgentSession", back_populates="tool_calls")
