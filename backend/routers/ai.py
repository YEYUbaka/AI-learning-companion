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
    # 打印请求信息（包括客户端IP和请求头）- 使用sys.stdout确保立即输出
    import sys
    import traceback
    from core.logger import logger as app_logger
    
    # 立即输出，确保能看到
    try:
        client_ip = request.client.host if request.client else "unknown"
        prompt_preview = question.prompt[:50] if question.prompt else 'None'
        
        # 使用多种方式输出，确保能看到
        sys.stdout.write(f"\n{'='*80}\n")
        sys.stdout.write(f"[AI请求] ========== 收到新请求 ==========\n")
        sys.stdout.write(f"[AI请求] 客户端IP: {client_ip}\n")
        sys.stdout.write(f"[AI请求] 请求URL: {request.url}\n")
        sys.stdout.write(f"[AI请求] prompt: {prompt_preview}...\n")
        sys.stdout.write(f"[AI请求] provider: {question.provider}\n")
        sys.stdout.write(f"[AI请求] history字段存在: {hasattr(question, 'history')}\n")
        sys.stdout.write(f"[AI请求] history值: {question.history}\n")
        sys.stdout.write(f"{'='*80}\n\n")
        sys.stdout.flush()
        
        # 同时使用print作为备用
        print(f"\n{'='*80}", flush=True)
        print(f"[AI请求-PRINT] ========== 收到新请求 ==========", flush=True)
        print(f"[AI请求-PRINT] 客户端IP: {client_ip}", flush=True)
        print(f"[AI请求-PRINT] prompt: {prompt_preview}...", flush=True)
        print(f"{'='*80}\n", flush=True)
        
        # 写入日志文件
        try:
            if app_logger.handlers:
                app_logger.info(f"[AI请求] 收到新请求 - 客户端: {client_ip}, prompt: {prompt_preview}..., provider: {question.provider}, history: {len(question.history) if question.history else 0}条")
            else:
                import logging
                root_logger = logging.getLogger()
                if root_logger.handlers:
                    root_logger.info(f"[AI请求] 收到新请求 - 客户端: {client_ip}, prompt: {prompt_preview}..., provider: {question.provider}, history: {len(question.history) if question.history else 0}条")
            
            # 直接写入文件（备用方案）
            from datetime import datetime
            from core.logger import log_file
            log_entry = f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - zhixueban - INFO - [AI请求] 收到新请求 - 客户端: {client_ip}, prompt: {prompt_preview}..., provider: {question.provider}, history: {len(question.history) if question.history else 0}条\n"
            with open(log_file, 'a', encoding='utf-8') as f:
                f.write(log_entry)
                f.flush()
        except Exception as log_err:
            sys.stdout.write(f"[ERROR] 写入日志失败: {log_err}\n")
            sys.stdout.flush()
    except Exception as e:
        error_msg = f"[ERROR] 打印请求信息时出错: {str(e)}"
        sys.stdout.write(error_msg + "\n")
        sys.stdout.write(f"[ERROR] 错误详情: {traceback.format_exc()}\n")
        sys.stdout.flush()
        try:
            if app_logger.handlers:
                app_logger.error(f"{error_msg}\n{traceback.format_exc()}")
            else:
                import logging
                root_logger = logging.getLogger()
                if root_logger.handlers:
                    root_logger.error(f"{error_msg}\n{traceback.format_exc()}")
        except:
            pass
    
    # 验证输入
    if not question.prompt or len(question.prompt.strip()) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="问题不能为空"
        )
    
    async def generate():
        import sys
        import traceback
        call_logged = False
        fallback_provider = question.provider or get_provider_config()
        
        # 立即输出，确保能看到生成器函数被调用
        sys.stdout.write(f"\n{'='*80}\n")
        sys.stdout.write(f"[生成器] ========== generate() 函数被调用 ==========\n")
        sys.stdout.write(f"[生成器] 时间戳: {__import__('datetime').datetime.now()}\n")
        sys.stdout.write(f"{'='*80}\n\n")
        sys.stdout.flush()
        print(f"[生成器-PRINT] generate() 函数被调用", flush=True)
        
        try:
            # 传递provider参数和对话历史
            used_provider = question.provider
            history = question.history or []
            
            sys.stdout.write(f"\n[上下文记忆] ========== 处理对话历史 ==========\n")
            sys.stdout.write(f"[上下文记忆] provider: {used_provider}\n")
            sys.stdout.write(f"[上下文记忆] 收到对话历史: {len(history)}条消息\n")
            sys.stdout.flush()
            print(f"[上下文记忆-PRINT] provider: {used_provider}, history: {len(history)}条", flush=True)
            
            if history:
                sys.stdout.write(f"[上下文记忆] 历史消息详情:\n")
                for i, msg in enumerate(history):
                    if isinstance(msg, dict):
                        role = msg.get('role', 'unknown')
                        content = msg.get('content', '')
                    else:
                        role = getattr(msg, 'role', 'unknown')
                        content = getattr(msg, 'content', '')
                    sys.stdout.write(f"  [{i+1}] {role}: {content[:80]}...\n")
                sys.stdout.flush()
            else:
                sys.stdout.write(f"[上下文记忆] ⚠️ 警告：没有收到对话历史！\n")
                sys.stdout.flush()
                print(f"[上下文记忆-PRINT] ⚠️ 警告：没有收到对话历史！", flush=True)
            sys.stdout.write(f"[上下文记忆] ====================================\n\n")
            sys.stdout.flush()
            
            sys.stdout.write(f"[生成器] 准备调用 ask_gpt_stream\n")
            sys.stdout.flush()
            print(f"[生成器-PRINT] 准备调用 ask_gpt_stream", flush=True)
            
            async for chunk in ask_gpt_stream(question.prompt, used_provider, history):
                chunk_type = chunk.get('type', 'unknown')
                chunk_provider = chunk.get('provider', 'unknown')
                sys.stdout.write(f"[生成器] 收到chunk: type={chunk_type}, provider={chunk_provider}\n")
                sys.stdout.flush()
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
            import sys
            import traceback
            error_msg = str(e)
            error_trace = traceback.format_exc()
            sys.stdout.write(f"\n[生成器-ERROR] ========== 发生错误 ==========\n")
            sys.stdout.write(f"[生成器-ERROR] 错误信息: {error_msg}\n")
            sys.stdout.write(f"[生成器-ERROR] 错误堆栈:\n{error_trace}\n")
            sys.stdout.write(f"[生成器-ERROR] ====================================\n\n")
            sys.stdout.flush()
            print(f"[生成器-ERROR-PRINT] 错误: {error_msg}", flush=True)
            error_chunk = {
                "type": "error",
                "content": str(e)
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
            import sys
            sys.stdout.write(f"[生成器] generate() 函数结束\n")
            sys.stdout.flush()
            print(f"[生成器-PRINT] generate() 函数结束", flush=True)
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
