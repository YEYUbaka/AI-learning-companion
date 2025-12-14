"""
API调用日志模型
作者：智学伴开发团队
目的：记录AI接口调用情况，用于后台统计
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, func
from database import Base


class APICallLog(Base):
    """记录每次AI接口调用"""
    __tablename__ = "api_call_logs"

    id = Column(Integer, primary_key=True, index=True)
    provider = Column(String(64), nullable=True)
    source = Column(String(32), nullable=False, default="user")  # user/admin_test等
    success = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


__all__ = ["APICallLog"]

