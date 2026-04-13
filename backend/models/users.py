"""
用户模型定义
"""
from sqlalchemy import Column, DateTime, Integer, String, text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


class User(Base):
    """用户表模型"""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, comment="用户ID")
    email = Column(String(255), unique=True, index=True, nullable=False, comment="用户邮箱")
    name = Column(String(100), nullable=False, comment="用户名称")
    hashed_password = Column(String(255), nullable=False, comment="加密密码")
    role = Column(String(20), default="user", nullable=False, comment="用户角色")
    token_version = Column(
        Integer,
        nullable=False,
        default=0,
        server_default=text("0"),
        comment="JWT 版本号",
    )
    created_at = Column(DateTime, server_default=func.now(), comment="创建时间")

    agent_sessions = relationship("AgentSession", back_populates="user")
