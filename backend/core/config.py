"""
配置管理模块
作者：智学伴开发团队
目的：统一管理环境变量和系统配置
环境变量：见 .env.example
测试：pytest backend/tests/test_config.py
"""
import os
from typing import Optional
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """应用配置类"""
    
    # 数据库配置
    DATABASE_URL: str = "sqlite:///./zhixueban.db"
    
    # JWT配置
    SECRET_KEY: str = "your-secret-key-change-in-production-please-use-strong-random-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30 * 24 * 60  # 30天
    
    # 加密密钥（用于加密存储的API密钥）
    ENCRYPTION_KEY: str = "default-encryption-key-change-in-production"
    
    # AI配置（默认值，实际从数据库读取）
    DEFAULT_AI_PROVIDER: str = "deepseek"
    AI_TIMEOUT: int = 120  # 秒（试卷生成需要更长时间，33道题可能需要90秒以上）
    AI_MAX_RETRIES: int = 3
    
    # 文件上传配置
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_EXTENSIONS: list[str] = [".pdf", ".docx", ".pptx", ".txt", ".md"]
    
    # 日志配置
    LOG_DIR: str = "logs"
    LOG_LEVEL: str = "INFO"
    
    # CORS配置
    CORS_ORIGINS: list[str] = ["*"]
    
    # 系统配置
    SYSTEM_NAME: str = "智学伴 AI个性化学习平台"
    SYSTEM_VERSION: str = "2.0.0"
    
    # 种子数据同步配置
    AUTO_SYNC_SEED_DATA: bool = True
    PROMPT_SEED_JSON: Optional[str] = None
    PROMPT_SEED_PATH: Optional[str] = None
    MODEL_CONFIG_SEED_JSON: Optional[str] = None
    MODEL_CONFIG_SEED_PATH: Optional[str] = None
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"  # 忽略.env中未定义的字段，避免验证错误


@lru_cache()
def get_settings() -> Settings:
    """获取配置实例（单例模式）"""
    return Settings()


# 全局配置实例
settings = get_settings()

