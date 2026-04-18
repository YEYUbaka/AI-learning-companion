"""
管理后台路由
作者：智学伴开发团队
目的：提供管理后台API接口（仅管理员可访问）
"""
import json
import httpx
from typing import List, Optional, Generator
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from database import get_db
from core.security import get_current_admin
from core.logger import logger
from models.users import User
from schemas.admin import (
    PromptCreate, PromptUpdate, PromptResponse,
    ModelConfigCreate, ModelConfigUpdate, ModelConfigResponse,
    ProviderTemplateItem, FetchModelListRequest, FetchModelListResponse,
    ModelTestRequest, ModelTestResponse,
    SystemConfigResponse, SystemConfigUpdate,
    DashboardStats, ChartDataResponse,
    UserResponse, UserListResponse,
    APICallLogResponse, APICallLogListResponse,
    FeatureModelConfigResponse, FeatureModelConfigUpdate,
)
from services.prompt_service import PromptService
from services.admin_service import AdminService
from services.feature_model_config_service import FeatureModelConfigService, _FEATURE_LABELS
from repositories.model_config_repo import ModelConfigRepository
from repositories.user_repo import UserRepository
from repositories.api_call_repo import APICallRepository
from core.security import encrypt_api_key, decrypt_api_key
from utils.model_registry import registry, PROVIDER_TEMPLATES
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/v1/admin", tags=["管理后台"])


# Dashboard
@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """获取Dashboard统计信息"""
    return AdminService.get_dashboard_stats(db)


@router.get("/chart-data", response_model=ChartDataResponse)
async def get_chart_data(
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """获取图表数据
    
    Args:
        days: 查看天数（1、7、30）
    """
    # 限制 days 参数范围
    if days not in [1, 7, 30]:
        days = 7
    return AdminService.get_chart_data(db, days=days)


# Prompt管理
@router.get("/prompts", response_model=List[PromptResponse])
async def get_prompts(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """获取所有Prompt"""
    prompts = PromptService.get_all_prompts(db, skip, limit)
    return prompts


@router.get("/prompts/{prompt_id}", response_model=PromptResponse)
async def get_prompt(
    prompt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """获取指定Prompt"""
    prompt = PromptService.get_prompt(db, prompt_id)
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt不存在")
    return prompt


@router.get("/prompts/name/{name}", response_model=List[PromptResponse])
async def get_prompts_by_name(
    name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """获取指定名称的所有版本"""
    prompts = PromptService.get_prompts_by_name(db, name)
    return prompts


@router.post("/prompts", response_model=PromptResponse, status_code=status.HTTP_201_CREATED)
async def create_prompt(
    data: PromptCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """创建Prompt"""
    prompt = PromptService.create_prompt(db, data)
    return prompt


@router.put("/prompts/{prompt_id}", response_model=PromptResponse)
async def update_prompt(
    prompt_id: int,
    data: PromptUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """更新Prompt"""
    prompt = PromptService.update_prompt(db, prompt_id, data)
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt不存在")
    return prompt


@router.delete("/prompts/{prompt_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_prompt(
    prompt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """删除Prompt"""
    success = PromptService.delete_prompt(db, prompt_id)
    if not success:
        raise HTTPException(status_code=404, detail="Prompt不存在")


@router.post("/prompts/{name}/enable/{version}", response_model=PromptResponse)
async def enable_prompt_version(
    name: str,
    version: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """启用指定版本的Prompt"""
    prompt = PromptService.enable_version(db, name, version)
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt版本不存在")
    return prompt


# 模型配置管理
@router.get("/models/templates", response_model=List[ProviderTemplateItem])
async def get_provider_templates(
    current_user: User = Depends(get_current_admin)
):
    """获取提供商模板列表"""
    templates = []
    for key, tpl in PROVIDER_TEMPLATES.items():
        templates.append(ProviderTemplateItem(
            key=key,
            display_name=tpl["display_name"],
            default_base_url=tpl["default_base_url"],
            default_model=tpl["default_model"],
            default_max_tokens=tpl["default_max_tokens"],
            available_models=tpl["available_models"],
            requires_extra_headers=tpl["requires_extra_headers"],
            extra_header_keys=tpl["extra_header_keys"],
            capabilities=tpl["capabilities"],
        ))
    return templates


@router.post("/models/fetch-model-list", response_model=FetchModelListResponse)
async def fetch_model_list(
    data: FetchModelListRequest,
    current_user: User = Depends(get_current_admin)
):
    """代理拉取提供商模型列表（避免前端跨域）"""
    try:
        base_url = data.base_url.rstrip("/")
        endpoint = f"{base_url}/models"
        headers = {
            "Authorization": f"Bearer {data.api_key}",
            "Content-Type": "application/json",
        }
        with httpx.Client(timeout=10) as client:
            response = client.get(endpoint, headers=headers)
            response.raise_for_status()
            result = response.json()
            models = [item["id"] for item in result.get("data", []) if "id" in item]
            return FetchModelListResponse(models=models)
    except Exception as e:
        logger.warning("拉取模型列表失败: %s", e)
        return FetchModelListResponse(models=[])


@router.get("/models/test-stream/{config_id}")
async def test_model_stream(
    config_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """流式测试模型调用（SSE），前端通过 EventSource / fetch ReadableStream 接收"""
    provider = registry.get_provider(str(config_id))
    if not provider:
        # 注册表仅缓存启用的配置，禁用配置需直接从 DB 构建
        config = ModelConfigRepository.get_by_id(db, config_id)
        if not config:
            raise HTTPException(status_code=404, detail=f"配置 ID {config_id} 不存在")
        provider = registry.build_provider_from_config(config)
        if not provider:
            raise HTTPException(status_code=400, detail=f"配置 ID {config_id} 无法构建提供商（API Key 可能为空）")

    test_messages = [{"role": "user", "content": "你好，请用一句话介绍你自己"}]

    def generate():
        try:
            yield from provider.call_stream(test_messages)
        except Exception as e:
            yield f'data: {json.dumps({"type": "error", "message": str(e)[:300]}, ensure_ascii=False)}\n\n'

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )


@router.get("/models", response_model=List[ModelConfigResponse])
async def get_model_configs(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """获取所有模型配置"""
    configs = ModelConfigRepository.get_all(db, skip, limit)
    return configs


@router.get("/models/{config_id}", response_model=ModelConfigResponse)
async def get_model_config(
    config_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """获取指定模型配置"""
    config = ModelConfigRepository.get_by_id(db, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="配置不存在")
    return config


@router.post("/models", response_model=ModelConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_model_config(
    data: ModelConfigCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """创建模型配置"""
    # 加密API密钥
    encrypted_key = encrypt_api_key(data.api_key) if data.api_key else None

    config = ModelConfigRepository.create(
        db=db,
        provider_name=data.provider_name,
        api_key=encrypted_key,
        base_url=data.base_url,
        priority=data.priority,
        enabled=data.enabled,
        params=data.params
    )

    # 重新加载注册表
    registry.load_from_db(db)

    return config


@router.put("/models/{config_id}", response_model=ModelConfigResponse)
async def update_model_config(
    config_id: int,
    data: ModelConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """更新模型配置"""
    # 如果提供了新密钥，需要加密
    encrypted_key = None
    if data.api_key is not None:
        encrypted_key = encrypt_api_key(data.api_key) if data.api_key else None
    
    update_data = {
        "provider_name": data.provider_name,
        "api_key": encrypted_key,
        "base_url": data.base_url,
        "priority": data.priority,
        "enabled": data.enabled,
        "params": data.params
    }
    # 移除None值
    update_data = {k: v for k, v in update_data.items() if v is not None}
    
    config = ModelConfigRepository.update(db, config_id, **update_data)
    if not config:
        raise HTTPException(status_code=404, detail="配置不存在")
    
    # 重新加载注册表
    registry.load_from_db(db)
    
    return config


@router.delete("/models/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_model_config(
    config_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """删除模型配置"""
    success = ModelConfigRepository.delete(db, config_id)
    if not success:
        raise HTTPException(status_code=404, detail="配置不存在")
    
    # 重新加载注册表
    registry.load_from_db(db)


# 测试模型调用
@router.post("/test-model-call", response_model=ModelTestResponse)
async def test_model_call(
    data: ModelTestRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """测试模型调用"""
    result = AdminService.test_model_call(db, data.provider_name, data.prompt)
    return result


# 系统配置
@router.get("/system-config", response_model=SystemConfigResponse)
async def get_system_config(
    current_user: User = Depends(get_current_admin)
):
    """获取系统配置"""
    return AdminService.get_system_config()


@router.put("/system-config", response_model=SystemConfigResponse)
async def update_system_config(
    data: SystemConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """更新系统配置"""
    config_dict = data.model_dump(exclude_unset=True)
    return AdminService.update_system_config(db, config_dict)


# 用户管理
@router.get("/users", response_model=UserListResponse)
async def get_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """获取用户列表"""
    users = UserRepository.get_all(db, skip=skip, limit=limit)
    total = UserRepository.count(db)
    return {
        "users": users,
        "total": total
    }


@router.put("/users/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: int,
    role: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """更新用户角色"""
    if role not in ["admin", "user"]:
        raise HTTPException(status_code=400, detail="角色必须是 admin 或 user")
    
    user = UserRepository.update_role(db, user_id, role)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user


# API调用日志查询
@router.get("/api-logs", response_model=APICallLogListResponse)
async def get_api_logs(
    skip: int = 0,
    limit: int = 100,
    provider: Optional[str] = None,
    source: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """获取API调用日志"""
    start_datetime = None
    end_datetime = None
    
    if start_date:
        try:
            start_datetime = datetime.strptime(start_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="开始日期格式错误，应为 YYYY-MM-DD")
    
    if end_date:
        try:
            end_datetime = datetime.strptime(end_date, "%Y-%m-%d")
            end_datetime = end_datetime.replace(hour=23, minute=59, second=59)
        except ValueError:
            raise HTTPException(status_code=400, detail="结束日期格式错误，应为 YYYY-MM-DD")
    
    result = AdminService.get_api_logs(
        db=db,
        skip=skip,
        limit=limit,
        provider=provider,
        source=source,
        start_date=start_datetime,
        end_date=end_datetime,
    )

    return result


# 功能专属模型路由
@router.get("/feature-model-configs", response_model=List[FeatureModelConfigResponse])
async def get_feature_model_configs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """获取全部功能专属模型配置"""
    configs = FeatureModelConfigService.get_all(db)
    result = []
    for cfg in configs:
        result.append(FeatureModelConfigResponse(
            feature_key=cfg.feature_key,
            feature_label=_FEATURE_LABELS.get(cfg.feature_key, cfg.feature_key),
            provider_name=cfg.provider_name,
            enabled=cfg.enabled,
            updated_at=cfg.updated_at,
        ))
    return result


@router.put("/feature-model-configs/{feature_key}", response_model=FeatureModelConfigResponse)
async def update_feature_model_config(
    feature_key: str,
    data: FeatureModelConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """更新功能专属模型配置"""
    cfg = FeatureModelConfigService.update(
        db=db,
        feature_key=feature_key,
        provider_name=data.provider_name,
        enabled=data.enabled,
    )
    return FeatureModelConfigResponse(
        feature_key=cfg.feature_key,
        feature_label=_FEATURE_LABELS.get(cfg.feature_key, cfg.feature_key),
        provider_name=cfg.provider_name,
        enabled=cfg.enabled,
        updated_at=cfg.updated_at,
    )

