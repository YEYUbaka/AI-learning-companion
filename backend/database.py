"""
数据库连接配置
作者：智学伴开发团队
目的：统一数据库连接配置，支持SQLite和MySQL
默认使用SQLite（zhixueban.db）
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from core.config import settings

# 从配置读取数据库URL（默认使用SQLite）
SQLALCHEMY_DATABASE_URL = settings.DATABASE_URL

# SQLite特殊配置
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    # SQLite需要check_same_thread=False（FastAPI多线程）
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},  # SQLite多线程支持
        echo=True,  # 设置为 False 可关闭 SQL 日志
    )
else:
    # MySQL/PostgreSQL等其他数据库
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        echo=True,  # 设置为 False 可关闭 SQL 日志
        pool_pre_ping=True,  # 连接池预检查
    )

# 创建 SessionLocal 类
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 创建 Base 类，用于模型继承
Base = declarative_base()


# 数据库会话依赖项
def get_db():
    """
    获取数据库会话
    在 FastAPI 路由中使用时，会自动处理会话的创建和关闭
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# 导出常用对象
__all__ = ["engine", "SessionLocal", "Base", "get_db"]
