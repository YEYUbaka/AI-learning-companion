"""
AI API 客户端封装
支持多家中国大模型API：DeepSeek、文心、星火、ChatGLM、Moonshot等
统一AI人设和返回格式
"""
from openai import OpenAI
from dotenv import load_dotenv
import os
import re
from typing import Optional, AsyncIterator

# 加载 .env 文件中的环境变量
load_dotenv()

# 统一的System Prompt
SYSTEM_PROMPT = "你是智学伴，一个AI个性化学习与测评助手，由智学伴项目团队开发。你应该以专业、温和的语气回答问题。"

# 支持的模型提供商
SUPPORTED_PROVIDERS = ["deepseek", "wenxin", "xinghuo", "chatglm", "moonshot"]

# 模型签名关键词（用于自动剥离）
MODEL_SIGNATURES = [
    "我是DeepSeek",
    "我是文心一言",
    "我是星火",
    "我是ChatGLM",
    "我是Moonshot",
    "我是通义千问",
    "我是Claude",
    "我是GPT",
    "我是OpenAI",
    "我是由",
    "我是AI助手",
    "我是人工智能助手",
]


def get_provider_config():
    """获取当前配置的模型提供商（默认：DeepSeek）"""
    # 优先使用环境变量，如果没有则默认使用 deepseek
    provider = os.getenv("AI_PROVIDER", "deepseek").lower()
    if provider not in SUPPORTED_PROVIDERS:
        print(f"[WARNING] 不支持的模型提供商: {provider}，使用默认值: deepseek")
        provider = "deepseek"
    # 确保默认返回 deepseek
    if not provider or provider == "":
        provider = "deepseek"
    return provider


def _normalize_base_url(url: Optional[str]) -> Optional[str]:
    """移除多余的 /chat/completions 或 /chat 后缀，避免重复路径导致404"""
    if not url:
        return url
    trimmed = url.rstrip("/")
    lowered = trimmed.lower()
    endings = ["/chat/completions", "/chat"]
    for ending in endings:
        if lowered.endswith(ending):
            trimmed = trimmed[: -len(ending)]
            lowered = trimmed.lower()
            trimmed = trimmed.rstrip("/")
            lowered = trimmed.lower()
    return trimmed


def get_api_config(provider: str) -> dict:
    """根据提供商获取API配置"""
    config = {}
    
    if provider == "deepseek":
        # DeepSeek支持两种配置方式：
        # 1. 使用DEEPSEEK_API_KEY（官方API）
        # 2. 使用AI_API_KEY（兼容硅基流动等代理）
        api_key = os.getenv("DEEPSEEK_API_KEY") or os.getenv("AI_API_KEY")
        base_url = os.getenv("DEEPSEEK_API_BASE_URL") or os.getenv("AI_API_BASE_URL", "https://api.deepseek.com/v1")
        model = os.getenv("DEEPSEEK_MODEL") or os.getenv("AI_MODEL", "deepseek-chat")
        config = {
            "api_key": api_key,
            "base_url": _normalize_base_url(base_url),
            "model": model,
            "provider_name": "DeepSeek"
        }
    elif provider == "wenxin":
        config = {
            "api_key": os.getenv("WENXIN_API_KEY"),
            "base_url": _normalize_base_url(os.getenv("WENXIN_API_BASE_URL", "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop")),
            "model": os.getenv("WENXIN_MODEL", "ernie-bot-turbo"),
            "provider_name": "文心一言"
        }
    elif provider == "xinghuo":
        config = {
            "api_key": os.getenv("XINGHUO_API_KEY"),
            "base_url": _normalize_base_url(os.getenv("XINGHUO_API_BASE_URL", "https://spark-api.xf-yun.com/v1")),
            "model": os.getenv("XINGHUO_MODEL", "general"),
            "provider_name": "星火"
        }
    elif provider == "chatglm":
        config = {
            "api_key": os.getenv("CHATGLM_API_KEY"),
            "base_url": _normalize_base_url(os.getenv("CHATGLM_API_BASE_URL", "https://open.bigmodel.cn/api/paas/v4")),
            "model": os.getenv("CHATGLM_MODEL", "glm-4"),
            "provider_name": "ChatGLM"
        }
    elif provider == "moonshot":
        config = {
            "api_key": os.getenv("MOONSHOT_API_KEY"),
            "base_url": _normalize_base_url(os.getenv("MOONSHOT_API_BASE_URL", "https://api.moonshot.cn/v1")),
            "model": os.getenv("MOONSHOT_MODEL", "moonshot-v1-8k"),
            "provider_name": "Moonshot"
        }
    
    return config


def clean_model_signature(text: str) -> str:
    """自动剥离模型签名，替换为统一人设"""
    if not text:
        return text
    
    # 替换模型签名
    for signature in MODEL_SIGNATURES:
        # 匹配 "我是XXX" 开头的句子
        pattern = rf"{re.escape(signature)}[^。！？\n]*[。！？\n]?"
        text = re.sub(pattern, "", text, flags=re.IGNORECASE)
    
    # 如果回答开头包含模型名称，替换为统一人设
    text = re.sub(
        r"^(我是|I am|I'm)\s*(DeepSeek|文心|星火|ChatGLM|Moonshot|通义|Claude|GPT|OpenAI)[^。！？\n]*[。！？\n]?",
        "",
        text,
        flags=re.IGNORECASE | re.MULTILINE
    )
    
    return text.strip()


def ask_gpt(prompt: str, provider: Optional[str] = None) -> tuple[bool, str, str]:
    """
    调用 AI 模型进行问答（非流式）
    
    Args:
        prompt: 用户输入的问题或提示
        
    Returns:
        tuple[bool, str, str]: (是否成功, 返回内容或错误信息, 提供商名称)
    """
    try:
        # 如果未指定provider，使用配置文件中的默认值
        if provider is None:
            provider = get_provider_config()
        elif provider not in SUPPORTED_PROVIDERS:
            provider = get_provider_config()
            print(f"[WARNING] 不支持的模型提供商，使用默认值: {provider}")
        
        config = get_api_config(provider)
        
        api_key = config.get("api_key")
        if not api_key:
            return False, f"错误：未配置 {provider.upper()}_API_KEY，请在 .env 文件中设置", provider
        
        base_url = config.get("base_url")
        model = config.get("model")
        provider_name = config.get("provider_name", provider)
        
        print(f"[DEBUG] Provider: {provider_name}")
        print(f"[DEBUG] Base URL: {base_url}")
        print(f"[DEBUG] Model: {model}")
        
        # 创建 OpenAI 客户端（兼容OpenAI格式的API）
        client = OpenAI(
            api_key=api_key,
            base_url=base_url
        )
        
        # 调用 AI 模型
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            max_tokens=2000,
            temperature=0.7,
        )
        
        # 提取返回内容
        answer = response.choices[0].message.content
        
        # 清理模型签名
        answer = clean_model_signature(answer)
        
        return True, answer, provider_name
        
    except Exception as e:
        error_msg = f"调用 AI 接口失败：{str(e)}"
        print(f"[DEBUG] AI Error: {type(e).__name__}: {e}")
        provider = get_provider_config()
        config = get_api_config(provider)
        provider_name = config.get("provider_name", provider)
        return False, error_msg, provider_name


async def ask_gpt_stream(prompt: str, provider: Optional[str] = None, history: Optional[list] = None) -> AsyncIterator[dict]:
    """
    流式调用 AI 模型（Server-Sent Events）
    
    Args:
        prompt: 用户输入的问题或提示
        provider: 模型提供商（可选）
        history: 对话历史列表，格式: [{"role": "user"/"assistant", "content": "..."}]
        
    Yields:
        dict: 包含类型、内容和提供商的字典
    """
    try:
        # 如果未指定provider，使用配置文件中的默认值
        import sys
        sys.stdout.write(f"\n[AI调用] ========== ask_gpt_stream 开始 ==========\n")
        sys.stdout.write(f"[AI调用] provider参数: {provider}\n")
        sys.stdout.write(f"[AI调用] history参数: {len(history) if history else 0}条消息\n")
        sys.stdout.flush()
        if provider is None:
            provider = get_provider_config()
            print(f"[DEBUG] 未指定provider，使用默认值: {provider}", flush=True)
        elif provider not in SUPPORTED_PROVIDERS:
            print(f"[WARNING] 不支持的模型提供商: {provider}，使用默认值", flush=True)
            provider = get_provider_config()
        
        sys.stdout.write(f"[AI调用] 最终使用的provider: {provider}\n")
        sys.stdout.flush()
        config = get_api_config(provider)
        
        api_key = config.get("api_key")
        if not api_key:
            error_msg = f"错误：未配置 {provider.upper()}_API_KEY，请在 .env 文件中设置。当前尝试使用的模型: {provider}"
            print(f"[ERROR] {error_msg}", flush=True)
            print(f"[ERROR] 检查的环境变量: {provider.upper()}_API_KEY = {os.getenv(f'{provider.upper()}_API_KEY')}", flush=True)
            yield {
                "type": "error",
                "content": error_msg,
                "provider": provider
            }
            return
        
        base_url = config.get("base_url")
        model = config.get("model")
        provider_name = config.get("provider_name", provider)
        
        print(f"[DEBUG] 调用模型 - Provider: {provider_name}, Base URL: {base_url}, Model: {model}", flush=True)
        
        # 创建 OpenAI 客户端
        client = OpenAI(
            api_key=api_key,
            base_url=base_url
        )
        
        # 构建消息列表（包含对话历史）
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        
        # 添加对话历史（如果有）
        if history:
            # 转换历史消息格式（前端发送的role可能是"ai"，需要转换为"assistant"）
            for msg in history:
                # 处理Pydantic模型或字典
                if hasattr(msg, "role"):
                    # Pydantic模型
                    role = msg.role
                    content = msg.content
                elif isinstance(msg, dict):
                    # 字典
                    role = msg.get("role", "user")
                    content = msg.get("content", "")
                else:
                    continue
                
                # 转换role格式
                if role == "ai":
                    role = "assistant"
                elif role not in ["user", "assistant", "system"]:
                    role = "user"
                
                if content and content.strip():
                    messages.append({"role": role, "content": content.strip()})
        
        # 添加当前用户消息
        messages.append({"role": "user", "content": prompt})
        
        sys.stdout.write(f"\n[消息构建] ========== 构建消息列表 ==========\n")
        sys.stdout.write(f"[消息构建] Provider: {provider_name}, Model: {model}\n")
        sys.stdout.write(f"[消息构建] 消息列表长度: {len(messages)} (包含{len(history) if history else 0}条历史消息)\n")
        
        if history:
            sys.stdout.write(f"[消息构建] 收到的历史消息详情:\n")
            for i, msg in enumerate(history[:5]):  # 只打印前5条
                if isinstance(msg, dict):
                    role = msg.get('role', 'unknown')
                    content = str(msg.get('content', ''))[:50]
                else:
                    role = getattr(msg, 'role', 'unknown')
                    content = str(getattr(msg, 'content', ''))[:50]
                sys.stdout.write(f"  [{i+1}] {role}: {content}...\n")
        
        sys.stdout.write(f"[消息构建] 完整消息列表（将发送给AI）:\n")
        for i, msg in enumerate(messages):
            role_icon = "👤" if msg['role'] == 'user' else "🤖" if msg['role'] == 'assistant' else "⚙️"
            sys.stdout.write(f"  {role_icon} [{i+1}] {msg['role']}: {msg['content'][:80]}...\n")
        sys.stdout.write(f"[消息构建] ====================================\n\n")
        sys.stdout.flush()
        
        # 写入日志文件（记录消息构建详情）
        try:
            import logging
            app_logger = logging.getLogger("zhixueban")
            if app_logger.handlers:
                app_logger.info(f"[消息构建] Provider: {provider_name}, Model: {model}, 消息列表长度: {len(messages)} (包含{len(history) if history else 0}条历史消息)")
                # 记录前3条历史消息的摘要
                if history and len(history) > 0:
                    history_summary = []
                    for i, msg in enumerate(history[:3]):
                        if isinstance(msg, dict):
                            role = msg.get('role', 'unknown')
                            content = str(msg.get('content', ''))[:50]
                        else:
                            role = getattr(msg, 'role', 'unknown')
                            content = str(getattr(msg, 'content', ''))[:50]
                        history_summary.append(f"{role}:{content}...")
                    app_logger.info(f"[消息构建] 历史消息摘要: {', '.join(history_summary)}")
                # 强制刷新文件
                for handler in app_logger.handlers:
                    if isinstance(handler, logging.FileHandler):
                        handler.flush()
        except Exception as log_err:
            sys.stdout.write(f"[WARNING] 写入日志失败: {log_err}\n")
            sys.stdout.flush()
        
        try:
            stream = client.chat.completions.create(
                model=model,
                messages=messages,  # 确保这里使用的是包含历史的完整消息列表
                max_tokens=2000,
                temperature=0.7,
                stream=True
            )
            sys.stdout.write(f"[AI调用] ✅ API调用成功，开始流式返回（消息数: {len(messages)}）\n")
            sys.stdout.flush()
            
            # 记录API调用成功
            try:
                import logging
                app_logger = logging.getLogger("zhixueban")
                if app_logger.handlers:
                    app_logger.info(f"[AI调用] ✅ API调用成功 - Provider: {provider_name}, Model: {model}, 消息数: {len(messages)}")
                    for handler in app_logger.handlers:
                        if isinstance(handler, logging.FileHandler):
                            handler.flush()
            except:
                pass
        except Exception as e:
            error_msg = f"API调用失败 - Provider: {provider_name}, Error: {str(e)}"
            print(f"[ERROR] {error_msg}", flush=True)
            yield {
                "type": "error",
                "content": f"调用{provider_name} API失败: {str(e)}",
                "provider": provider
            }
            return
        
        # 用于累积完整文本以便清理签名
        full_content = ""
        
        # 逐块返回内容
        for chunk in stream:
            if chunk.choices and len(chunk.choices) > 0:
                delta = chunk.choices[0].delta
                if delta and delta.content:
                    content = delta.content
                    full_content += content
                    yield {
                        "type": "content",
                        "content": content,
                        "provider": provider_name
                    }
        
        # 流式输出完成后，清理完整内容的签名（可选，因为已经逐块发送）
        # 这里我们主要依赖system prompt来避免模型自报家门
        
    except Exception as e:
        error_msg = f"调用 AI 接口失败：{str(e)}"
        print(f"[DEBUG] AI Stream Error: {type(e).__name__}: {e}")
        provider = get_provider_config()
        config = get_api_config(provider)
        provider_name = config.get("provider_name", provider)
        yield {
            "type": "error",
            "content": error_msg,
            "provider": provider_name
        }


def get_supported_providers() -> list:
    """获取支持的模型提供商列表"""
    return SUPPORTED_PROVIDERS
