"""
认证服务
作者：智学伴开发团队
目的：认证业务逻辑层
"""
from typing import Optional
from sqlalchemy.orm import Session
from repositories.user_repo import UserRepository
from core.security import hash_password, verify_password, create_access_token
from core.logger import logger
from datetime import timedelta
from core.config import settings


class AuthService:
    """认证服务类"""
    
    @staticmethod
    def register_user(db: Session, email: str, name: str, password: str) -> dict:
        """注册用户"""
        # 检查邮箱是否已存在
        existing_user = UserRepository.get_by_email(db, email)
        if existing_user:
            raise ValueError("该邮箱已被注册")
        
        # 验证密码长度
        if len(password) < 6:
            raise ValueError("密码长度至少为6位")
        
        # 创建用户
        hashed_password = hash_password(password)
        # 第一个用户自动设为管理员
        user_count = UserRepository.count(db)
        role = "admin" if user_count == 0 else "user"
        
        user = UserRepository.create(
            db=db,
            email=email,
            name=name,
            hashed_password=hashed_password,
            role=role
        )
        
        logger.info(f"新用户注册: {email}, 角色: {role}")
        return {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role
        }
    
    @staticmethod
    def login_user(db: Session, email: str, password: str) -> dict:
        """用户登录"""
        user = UserRepository.get_by_email(db, email)
        if not user:
            raise ValueError("邮箱或密码错误")
        
        if not verify_password(password, user.hashed_password):
            raise ValueError("邮箱或密码错误")
        
        # 创建token
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(user.id), "email": user.email, "role": user.role},
            expires_delta=access_token_expires
        )
        
        logger.info(f"用户登录: {email}")
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "role": user.role
            }
        }

