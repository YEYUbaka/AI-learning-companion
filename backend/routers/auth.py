"""
用户认证相关路由
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from core.security import get_current_user
from database import get_db
from models.users import User
from schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from services.auth_service import AuthService


router = APIRouter(prefix="/api/v1/auth", tags=["认证"])


def _raise_auth_http_error(error: ValueError) -> None:
    detail = str(error)
    if detail in {"邮箱或密码错误", "当前密码错误"}:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        ) from error
    if detail == "用户不存在":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail) from error
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail) from error


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: RegisterRequest, db: Session = Depends(get_db)):
    try:
        user = AuthService.register_user(
            db,
            email=user_data.email,
            name=user_data.name,
            password=user_data.password,
        )
    except ValueError as error:
        _raise_auth_http_error(error)

    return UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        role=user["role"],
        message="注册成功",
    )


@router.post("/login", response_model=TokenResponse)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    try:
        return AuthService.login_user(db, form_data.username, form_data.password)
    except ValueError as error:
        _raise_auth_http_error(error)


@router.post("/login-json", response_model=TokenResponse)
async def login_json(login_data: LoginRequest, db: Session = Depends(get_db)):
    try:
        return AuthService.login_user(db, login_data.email, login_data.password)
    except ValueError as error:
        _raise_auth_http_error(error)


@router.post("/change-password", response_model=TokenResponse)
async def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return AuthService.change_password(
            db,
            user_id=current_user.id,
            current_password=payload.current_password,
            new_password=payload.new_password,
        )
    except ValueError as error:
        _raise_auth_http_error(error)
