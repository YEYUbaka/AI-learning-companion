"""
AI相关Schemas
作者：智学伴开发团队
目的：定义AI调用相关的请求和响应模型
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any


class AIRequest(BaseModel):
    """AI请求模型"""
    prompt: str = Field(..., description="用户输入的提示词")
    provider: Optional[str] = Field(None, description="指定使用的AI提供商（可选）")
    temperature: Optional[float] = Field(0.7, ge=0, le=2, description="温度参数")
    max_tokens: Optional[int] = Field(2000, ge=1, le=8000, description="最大token数")


class AIResponse(BaseModel):
    """AI响应模型"""
    success: bool
    answer: str = Field(..., description="AI回答内容")
    provider: str = Field(..., description="使用的AI提供商")
    metadata: Optional[Dict[str, Any]] = Field(None, description="元数据（延迟、token数等）")
    message: str = "AI回答生成成功"

