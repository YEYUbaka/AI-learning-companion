"""
AI 问答相关路由
支持多家中国大模型API的智能问答
"""
from fastapi import APIRouter, HTTPException, status, Request, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from utils.openai_client import ask_gpt, ask_gpt_stream, get_supported_providers, get_provider_config
import json
from sqlalchemy.orm import Session
from database import get_db
from repositories.api_call_repo import APICallRepository

# 创建路由器
router = APIRouter(prefix="/api/v1/ai", tags=["AI问答"])


# 请求模型
class Message(BaseModel):
    """消息模型"""
    role: str  # "user" 或 "assistant"
    content: str

class AIQuestion(BaseModel):
    """AI 问答请求模型"""
    prompt: str
    provider: Optional[str] = None  # 可选的模型提供商，如果不指定则使用.env中的默认值
    history: Optional[list] = None  # 对话历史，用于上下文记忆（可以是Message对象或字典）
    
    class Config:
        # 允许任意类型，因为history可能是字典列表
        arbitrary_types_allowed = True


# 响应模型
class AIResponse(BaseModel):
    """AI 问答响应模型"""
    success: bool
    answer: str
    message: str
    provider: str = "DeepSeek"


@router.post("/ask", response_model=AIResponse)
async def ask_ai(question: AIQuestion, db: Session = Depends(get_db)):
    """
    AI 智能问答接口（非流式）
    
    参数：
    - prompt: 用户问题或提示
    
    返回：
    - success: 是否成功
    - answer: AI 回答内容
    - message: 附加消息
    """
    # 验证输入
    if not question.prompt or len(question.prompt.strip()) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="问题不能为空"
        )
    
    # 调用 AI 函数（支持动态切换模型）
    success, result, provider = ask_gpt(question.prompt, question.provider)
    
    if success:
        APICallRepository.record_call(db, provider, source="user_chat", success=True)
        return AIResponse(
            success=True,
            answer=result,
            message="AI 回答生成成功",
            provider=provider
        )
    else:
        APICallRepository.record_call(db, provider, source="user_chat", success=False)
        return AIResponse(
            success=False,
            answer="",
            message=result,
            provider=provider
        )


@router.post("/ask/stream")
async def ask_ai_stream(question: AIQuestion, request: Request, db: Session = Depends(get_db)):
    """
    AI 智能问答接口（流式输出）
    
    参数：
    - prompt: 用户问题或提示
    - provider: 可选的模型提供商（如果不指定则使用.env中的默认值）
    
    返回：
    - Server-Sent Events 流式响应
    """
    from core.logger import logger as app_logger

    client_ip = request.client.host if request.client else "unknown"
    prompt_preview = question.prompt[:50] if question.prompt else 'None'
    history_count = len(question.history) if question.history else 0
    app_logger.info(f"[AI请求] 客户端: {client_ip}, prompt: {prompt_preview}..., provider: {question.provider}, history: {history_count}条")
    
    # 验证输入
    if not question.prompt or len(question.prompt.strip()) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="问题不能为空"
        )
    
    async def generate():
        call_logged = False
        fallback_provider = question.provider or get_provider_config()

        used_provider = question.provider
        history = question.history or []
        history_count = len(history)
        app_logger.info(f"[AI流式] provider: {used_provider}, history: {history_count}条")

        try:
            async for chunk in ask_gpt_stream(question.prompt, used_provider, history):
                chunk_type = chunk.get('type', 'unknown')
                chunk_provider = chunk.get('provider', 'unknown')
                app_logger.debug(f"[AI流式] chunk: type={chunk_type}, provider={chunk_provider}")
                if not call_logged and chunk_provider:
                    APICallRepository.record_call(
                        db,
                        chunk_provider,
                        source="user_chat_stream",
                        success=(chunk_type != "error")
                    )
                    call_logged = True
                yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
        except Exception as e:
            error_msg = str(e)
            app_logger.error(f"[AI流式] 错误: {error_msg}", exc_info=True)
            error_chunk = {
                "type": "error",
                "content": error_msg
            }
            yield f"data: {json.dumps(error_chunk, ensure_ascii=False)}\n\n"
            if not call_logged:
                APICallRepository.record_call(
                    db,
                    fallback_provider,
                    source="user_chat_stream",
                    success=False
                )
                call_logged = True
        finally:
            app_logger.debug("[AI流式] generate() 结束")
            if not call_logged:
                APICallRepository.record_call(
                    db,
                    fallback_provider,
                    source="user_chat_stream",
                    success=False
                )
            yield "data: [DONE]\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")


@router.get("/providers")
async def get_providers():
    """
    获取支持的AI模型提供商列表
    
    返回：
    - providers: 支持的模型提供商数组
    - current: 当前配置的模型提供商（默认：deepseek）
    """
    current = get_provider_config()
    # 确保默认返回 deepseek
    if not current or current == "":
        current = "deepseek"
    return {
        "providers": get_supported_providers(),
        "current": current
    }
