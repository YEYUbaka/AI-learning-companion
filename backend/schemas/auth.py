"""
认证相关 Schemas
"""
from typing import Dict

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=6, max_length=50)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6, max_length=50)


class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    role: str = "user"
    message: str = "操作成功"

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, object]


# 兼容旧命名
UserRegister = RegisterRequest
UserLogin = LoginRequest
