"""
模型配置模型
作者：智学伴开发团队
目的：存储和管理AI模型配置（API密钥、URL、参数等）
测试：pytest backend/tests/test_admin.py
"""
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, JSON
from sqlalchemy.sql import func
from database import Base


class ModelConfig(Base):
    """
    模型配置表
    用于存储各AI提供商的配置信息
    """
    __tablename__ = "model_configs"
    
    id = Column(Integer, primary_key=True, index=True, comment="配置ID")
    provider_name = Column(String(50), nullable=False, unique=True, index=True, comment="提供商名称（如：deepseek, qwen, chatglm等）")
    api_key = Column(Text, nullable=True, comment="加密后的API密钥")
    base_url = Column(String(500), nullable=True, comment="API基础URL")
    priority = Column(Integer, default=0, nullable=False, comment="优先级（数字越大优先级越高）")
    enabled = Column(Boolean, default=True, nullable=False, comment="是否启用")
    params = Column(JSON, nullable=True, comment="其他参数（JSON格式，如：temperature, max_tokens等）")
    created_at = Column(DateTime, server_default=func.now(), nullable=False, comment="创建时间")
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False, comment="更新时间")
    
    __table_args__ = (
        {"sqlite_autoincrement": True},
    )

