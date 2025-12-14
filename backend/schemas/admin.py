"""
管理后台相关Schemas
作者：智学伴开发团队
目的：定义管理后台的请求和响应模型
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime


# Prompt相关Schemas
class PromptCreate(BaseModel):
    """创建Prompt请求模型"""
    name: str = Field(..., min_length=1, max_length=100, description="Prompt名称")
    content: str = Field(..., description="Prompt内容")
    description: Optional[str] = Field(None, description="描述")
    enabled: bool = Field(True, description="是否启用")
    author: Optional[str] = Field(None, description="创建者")


class PromptUpdate(BaseModel):
    """更新Prompt请求模型"""
    content: Optional[str] = Field(None, description="Prompt内容")
    description: Optional[str] = Field(None, description="描述")
    enabled: Optional[bool] = Field(None, description="是否启用")


class PromptResponse(BaseModel):
    """Prompt响应模型"""
    id: int
    name: str
    version: int
    content: str
    description: Optional[str]
    enabled: bool
    author: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# ModelConfig相关Schemas
class ModelConfigCreate(BaseModel):
    """创建模型配置请求模型"""
    provider_name: str = Field(..., min_length=1, max_length=50, description="提供商名称")
    api_key: Optional[str] = Field(None, description="API密钥")
    base_url: Optional[str] = Field(None, description="API基础URL")
    priority: int = Field(0, description="优先级")
    enabled: bool = Field(True, description="是否启用")
    params: Optional[Dict[str, Any]] = Field(None, description="其他参数")


class ModelConfigUpdate(BaseModel):
    """更新模型配置请求模型"""
    provider_name: Optional[str] = Field(None, min_length=1, max_length=50, description="提供商名称")
    api_key: Optional[str] = Field(None, description="API密钥")
    base_url: Optional[str] = Field(None, description="API基础URL")
    priority: Optional[int] = Field(None, description="优先级")
    enabled: Optional[bool] = Field(None, description="是否启用")
    params: Optional[Dict[str, Any]] = Field(None, description="其他参数")


class ModelConfigResponse(BaseModel):
    """模型配置响应模型"""
    id: int
    provider_name: str
    base_url: Optional[str]
    priority: int
    enabled: bool
    params: Optional[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# 测试模型调用
class ModelTestRequest(BaseModel):
    """测试模型调用请求模型"""
    provider_name: str = Field(..., description="提供商名称")
    prompt: str = Field(..., description="测试提示词")


class ModelTestResponse(BaseModel):
    """测试模型调用响应模型"""
    success: bool
    provider: str
    raw_response: str
    cleaned_text: str
    latency_ms: float
    error: Optional[str] = None


# 系统配置
class SystemConfigResponse(BaseModel):
    """系统配置响应模型"""
    max_upload_size: int
    ai_response_token_limit: int
    markdown_rendering_mode: str
    logging_level: str
    other_settings: Optional[Dict[str, Any]] = None


class SystemConfigUpdate(BaseModel):
    """更新系统配置请求模型"""
    max_upload_size: Optional[int] = Field(None, ge=1, description="最大上传文件大小（字节）")
    ai_response_token_limit: Optional[int] = Field(None, ge=1, description="AI响应token限制")
    markdown_rendering_mode: Optional[str] = Field(None, description="Markdown渲染模式")
    logging_level: Optional[str] = Field(None, description="日志级别")
    other_settings: Optional[Dict[str, Any]] = Field(None, description="其他设置")


# Dashboard统计
class DashboardStats(BaseModel):
    """Dashboard统计模型"""
    total_users: int
    active_models: int
    total_prompts: int
    api_calls_today: int
    api_calls_total: int


# 图表数据
class ChartDataItem(BaseModel):
    """图表数据项"""
    name: str
    value: int


class DailyStatsItem(BaseModel):
    """每日统计数据项"""
    date: str
    count: int


class ChartDataResponse(BaseModel):
    """图表数据响应模型"""
    provider_stats: List[ChartDataItem]
    source_stats: List[ChartDataItem]
    daily_stats: List[DailyStatsItem]
    is_hourly: bool = False  # 是否为小时数据


# 用户管理
class UserResponse(BaseModel):
    """用户响应模型"""
    id: int
    email: str
    name: str
    role: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    """用户列表响应模型"""
    users: List[UserResponse]
    total: int


# API调用日志
class APICallLogResponse(BaseModel):
    """API调用日志响应模型"""
    id: int
    provider: Optional[str]
    source: str
    success: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class APICallLogListResponse(BaseModel):
    """API调用日志列表响应模型"""
    logs: List[APICallLogResponse]
    total: int

