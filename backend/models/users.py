"""
用户模型定义
作者：智学伴开发团队
目的：用户数据模型，支持角色管理
"""
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from database import Base


class User(Base):
    """
    用户表模型
    """
    __tablename__ = "users"

    # 主键：用户ID
    id = Column(Integer, primary_key=True, index=True, comment="用户ID")
    
    # 用户邮箱（唯一）
    email = Column(String(255), unique=True, index=True, nullable=False, comment="用户邮箱")
    
    # 用户姓名
    name = Column(String(100), nullable=False, comment="用户姓名")
    
    # 加密后的密码
    hashed_password = Column(String(255), nullable=False, comment="加密密码")
    
    # 用户角色（admin, user）
    role = Column(String(20), default="user", nullable=False, comment="用户角色")
    
    # 创建时间（自动设置）
    created_at = Column(DateTime, server_default=func.now(), comment="创建时间")
