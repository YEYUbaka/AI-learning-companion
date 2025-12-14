"""
Prompt模型
作者：智学伴开发团队
目的：存储和管理AI Prompt模板，支持版本管理
测试：pytest backend/tests/test_prompt.py
"""
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from database import Base


class Prompt(Base):
    """
    Prompt表模型
    用于存储AI提示词模板，支持版本管理
    """
    __tablename__ = "prompts"
    
    id = Column(Integer, primary_key=True, index=True, comment="Prompt ID")
    name = Column(String(100), nullable=False, index=True, comment="Prompt名称（如：system_prompt, quiz_generator等）")
    version = Column(Integer, nullable=False, default=1, comment="版本号")
    content = Column(Text, nullable=False, comment="Prompt内容")
    description = Column(Text, nullable=True, comment="描述")
    enabled = Column(Boolean, default=True, nullable=False, comment="是否启用")
    author = Column(String(100), nullable=True, comment="创建者")
    created_at = Column(DateTime, server_default=func.now(), nullable=False, comment="创建时间")
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False, comment="更新时间")
    
    # 唯一约束：同一名称的同一版本只能有一条记录
    __table_args__ = (
        {"sqlite_autoincrement": True},
    )

