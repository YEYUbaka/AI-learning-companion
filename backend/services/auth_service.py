"""
认证服务
"""
from datetime import timedelta

from sqlalchemy.orm import Session

from core.config import settings
from core.logger import logger
from core.security import create_access_token, hash_password, verify_password
from repositories.user_repo import UserRepository
from utils.password_policy import validate_password


class AuthService:
    """认证业务逻辑"""

    @staticmethod
    def register_user(db: Session, email: str, name: str, password: str) -> dict:
        existing_user = UserRepository.get_by_email(db, email)
        if existing_user:
            raise ValueError("该邮箱已被注册")

        validate_password(password)

        user = UserRepository.create(
            db=db,
            email=email,
            name=name,
            hashed_password=hash_password(password),
            role="user",
        )

        logger.info("[INFO] 新用户注册: %s", email)
        return {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
        }

    @staticmethod
    def login_user(db: Session, email: str, password: str) -> dict:
        user = UserRepository.get_by_email(db, email)
        if not user or not verify_password(password, user.hashed_password):
            raise ValueError("邮箱或密码错误")

        access_token = AuthService._build_access_token(user)

        logger.info("[INFO] 用户登录: %s", email)
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "role": user.role,
            },
        }

    @staticmethod
    def change_password(db: Session, user_id: int, current_password: str, new_password: str) -> dict:
        user = UserRepository.get_by_id(db, user_id)
        if not user:
            raise ValueError("用户不存在")
        if not verify_password(current_password, user.hashed_password):
            raise ValueError("当前密码错误")

        validate_password(new_password)
        updated_user = UserRepository.update_password(db, user_id, hash_password(new_password))
        if not updated_user:
            raise ValueError("用户不存在")

        logger.info("[INFO] 用户修改密码: user_id=%s", user_id)
        return {
            "access_token": AuthService._build_access_token(updated_user),
            "token_type": "bearer",
            "user": {
                "id": updated_user.id,
                "email": updated_user.email,
                "name": updated_user.name,
                "role": updated_user.role,
            },
        }

    @staticmethod
    def admin_reset_password(db: Session, user_id: int, new_password: str) -> dict:
        validate_password(new_password)

        updated_user = UserRepository.update_password(db, user_id, hash_password(new_password))
        if not updated_user:
            raise ValueError("用户不存在")

        logger.info("[WARNING] 管理员重置密码: user_id=%s", user_id)
        return {
            "id": updated_user.id,
            "email": updated_user.email,
            "name": updated_user.name,
            "role": updated_user.role,
            "token_version": updated_user.token_version,
        }

    @staticmethod
    def _build_access_token(user) -> str:
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        return create_access_token(
            data={
                "sub": str(user.id),
                "email": user.email,
                "role": user.role,
                "token_version": user.token_version or 0,
            },
            expires_delta=access_token_expires,
        )
