"""
认证相关Schemas
作者：智学伴开发团队
目的：定义认证相关的请求和响应模型
"""
from pydantic import BaseModel, EmailStr, Field


class UserRegister(BaseModel):
    """用户注册请求模型"""
    email: EmailStr = Field(..., description="用户邮箱")
    name: str = Field(..., min_length=1, max_length=100, description="用户姓名")
    password: str = Field(..., min_length=6, description="用户密码（至少6位）")


class UserLogin(BaseModel):
    """用户登录请求模型"""
    email: EmailStr = Field(..., description="用户邮箱")
    password: str = Field(..., description="用户密码")


class UserResponse(BaseModel):
    """用户响应模型"""
    id: int
    email: str
    name: str
    role: str = "user"
    message: str = "操作成功"
    
    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    """登录响应模型"""
    access_token: str
    token_type: str = "bearer"
    user: dict

