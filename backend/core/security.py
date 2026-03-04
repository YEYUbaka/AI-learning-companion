"""
安全模块
作者：智学伴开发团队
目的：提供JWT、密码加密、API密钥加密等安全功能
环境变量：SECRET_KEY, ENCRYPTION_KEY
测试：pytest backend/tests/test_security.py
"""
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from cryptography.fernet import Fernet
import base64
import hashlib

from core.config import settings
from database import get_db
from models.users import User

# 密码加密上下文
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def hash_password(password: str) -> str:
    """使用 bcrypt 加密密码"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """创建JWT token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> dict:
    """解码JWT token"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_encryption_key() -> bytes:
    """从配置生成加密密钥（Fernet需要32字节的base64编码密钥）"""
    key = settings.ENCRYPTION_KEY.encode()
    # 使用SHA256生成32字节密钥
    key_hash = hashlib.sha256(key).digest()
    return base64.urlsafe_b64encode(key_hash)


def encrypt_api_key(api_key: str) -> str:
    """加密API密钥"""
    if not api_key:
        return ""
    f = Fernet(get_encryption_key())
    encrypted = f.encrypt(api_key.encode())
    return encrypted.decode()


def decrypt_api_key(encrypted_key: str) -> str:
    """解密API密钥"""
    if not encrypted_key:
        return ""
    try:
        f = Fernet(get_encryption_key())
        decrypted = f.decrypt(encrypted_key.encode())
        return decrypted.decode()
    except Exception as e:
        # 如果解密失败，可能是未加密的旧数据，直接返回
        return encrypted_key


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """获取当前登录用户（用于依赖注入）"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    return user


async def get_current_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    """获取当前管理员用户（用于依赖注入）"""
    # 检查用户角色
    # 如果role字段为admin，或者email以admin开头，或者是第一个用户（默认管理员）
    if hasattr(current_user, 'role'):
        if current_user.role == 'admin':
            return current_user
        # 如果不是admin，检查是否是第一个用户
        from sqlalchemy.orm import Session
        from database import SessionLocal
        from repositories.user_repo import UserRepository
        db = SessionLocal()
        try:
            first_user = UserRepository.get_all(db, skip=0, limit=1)
            if first_user and first_user[0].id == current_user.id:
                # 第一个用户自动设为管理员
                UserRepository.update_role(db, current_user.id, 'admin')
                return current_user
        finally:
            db.close()
    elif current_user.email.startswith('admin'):
        return current_user
    
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="需要管理员权限"
    )

