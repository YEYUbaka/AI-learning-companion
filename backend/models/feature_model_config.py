from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from database import Base


class FeatureModelConfig(Base):
    """功能专属模型配置表，为每个 AI 功能指定使用的 Provider"""
    __tablename__ = "feature_model_configs"

    id = Column(Integer, primary_key=True, index=True)
    feature_key = Column(String(50), unique=True, nullable=False, index=True)
    provider_name = Column(String(50), nullable=True)  # NULL 表示使用系统默认优先级
    enabled = Column(Boolean, default=True, nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        {"sqlite_autoincrement": True},
    )
