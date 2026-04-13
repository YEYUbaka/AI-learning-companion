"""
用户 Repository
"""
from typing import Optional

from sqlalchemy.orm import Session

from models.users import User


class UserRepository:
    """用户数据访问层"""

    @staticmethod
    def get_by_id(db: Session, user_id: int) -> Optional[User]:
        return db.query(User).filter(User.id == user_id).first()

    @staticmethod
    def get_by_email(db: Session, email: str) -> Optional[User]:
        return db.query(User).filter(User.email == email).first()

    @staticmethod
    def create(db: Session, email: str, name: str, hashed_password: str, role: str = "user") -> User:
        user = User(
            email=email,
            name=name,
            hashed_password=hashed_password,
            role=role,
            token_version=0,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def update_role(db: Session, user_id: int, role: str) -> Optional[User]:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            user.role = role
            db.commit()
            db.refresh(user)
        return user

    @staticmethod
    def update_password(db: Session, user_id: int, hashed_password: str) -> Optional[User]:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            user.hashed_password = hashed_password
            user.token_version = (user.token_version or 0) + 1
            db.commit()
            db.refresh(user)
        return user

    @staticmethod
    def get_all(db: Session, skip: int = 0, limit: int = 100):
        return db.query(User).offset(skip).limit(limit).all()

    @staticmethod
    def count(db: Session) -> int:
        return db.query(User).count()
