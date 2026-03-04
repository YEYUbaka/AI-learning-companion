"""
用户Repository
作者：智学伴开发团队
目的：用户数据访问层
"""
from typing import Optional
from sqlalchemy.orm import Session
from models.users import User


class UserRepository:
    """用户数据访问类"""
    
    @staticmethod
    def get_by_id(db: Session, user_id: int) -> Optional[User]:
        """根据ID获取用户"""
        return db.query(User).filter(User.id == user_id).first()
    
    @staticmethod
    def get_by_email(db: Session, email: str) -> Optional[User]:
        """根据邮箱获取用户"""
        return db.query(User).filter(User.email == email).first()
    
    @staticmethod
    def create(db: Session, email: str, name: str, hashed_password: str, role: str = "user") -> User:
        """创建新用户"""
        user = User(
            email=email,
            name=name,
            hashed_password=hashed_password,
            role=role
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    
    @staticmethod
    def update_role(db: Session, user_id: int, role: str) -> Optional[User]:
        """更新用户角色"""
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            user.role = role
            db.commit()
            db.refresh(user)
        return user
    
    @staticmethod
    def get_all(db: Session, skip: int = 0, limit: int = 100):
        """获取所有用户"""
        return db.query(User).offset(skip).limit(limit).all()
    
    @staticmethod
    def count(db: Session) -> int:
        """获取用户总数"""
        return db.query(User).count()

