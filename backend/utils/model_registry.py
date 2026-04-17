"""
模型注册表
作者：智学伴开发团队
目的：统一管理各AI提供商的调用方法，支持fallback策略
环境变量：从数据库读取（ModelConfig表）
测试：pytest backend/tests/test_model_registry.py
"""
import json
import time
import httpx
from typing import Optional, Dict, Any, List, Tuple, Generator
from abc import ABC, abstractmethod
from core.logger import logger
from core.config import settings
from core.security import decrypt_api_key
from sqlalchemy.orm import Session
from repositories.model_config_repo import ModelConfigRepository


class AIProvider(ABC):
    """AI提供商抽象基类"""

    @abstractmethod
    def call(self, messages: List[Dict[str, str]], **kwargs) -> Dict[str, Any]:
        """调用AI模型"""
        pass


class OpenAICompatProvider(AIProvider):
    """通用 OpenAI 兼容提供商（支持所有兼容 OpenAI Chat Completions 格式的接口）"""

    def __init__(
        self,
        api_key: str,
        base_url: str,
        model_name: str,
        temperature: float = 0.7,
        max_tokens: int = settings.AI_DEFAULT_MAX_TOKENS,
        top_p: float = 1.0,
        extra_headers: Optional[Dict[str, str]] = None,
        timeout: int = 60,
    ):
        self.api_key = api_key
        # 去除末尾斜杠，call() 内部统一拼接 /chat/completions
        self.base_url = base_url.rstrip("/")
        self.model_name = model_name
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.top_p = top_p
        self.extra_headers = extra_headers or {}
        self.timeout = timeout

    def call(self, messages: List[Dict[str, str]], **kwargs) -> Dict[str, Any]:
        """调用 OpenAI 兼容接口"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            **self.extra_headers,
        }
        payload = {
            "model": kwargs.get("model", self.model_name),
            "messages": messages,
            "temperature": kwargs.get("temperature", self.temperature),
            "max_tokens": kwargs.get("max_tokens", self.max_tokens),
            "top_p": kwargs.get("top_p", self.top_p),
        }
        endpoint = self.base_url + "/chat/completions"
        with httpx.Client(timeout=self.timeout) as client:
            response = client.post(endpoint, json=payload, headers=headers)
            response.raise_for_status()
            result = response.json()
            return {
                "text": result["choices"][0]["message"]["content"],
                "usage": result.get("usage", {}),
                "model": result.get("model", self.model_name),
            }

    def call_stream(self, messages: List[Dict[str, str]], **kwargs) -> Generator[str, None, None]:
        """流式调用 OpenAI 兼容接口，产生 SSE 格式数据块"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            **self.extra_headers,
        }
        payload = {
            "model": kwargs.get("model", self.model_name),
            "messages": messages,
            "temperature": kwargs.get("temperature", self.temperature),
            "max_tokens": kwargs.get("max_tokens", self.max_tokens),
            "top_p": kwargs.get("top_p", self.top_p),
            "stream": True,
        }
        endpoint = self.base_url + "/chat/completions"
        start_time = time.time()

        try:
            with httpx.Client(timeout=self.timeout) as client:
                with client.stream("POST", endpoint, json=payload, headers=headers) as response:
                    response.raise_for_status()
                    model_name = self.model_name
                    for line in response.iter_lines():
                        line = line.strip()
                        if not line or line == "data: [DONE]":
                            continue
                        if line.startswith("data: "):
                            try:
                                chunk_data = json.loads(line[6:])
                                delta = chunk_data.get("choices", [{}])[0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    yield f'data: {json.dumps({"type": "token", "content": content}, ensure_ascii=False)}\n\n'
                                if chunk_data.get("model"):
                                    model_name = chunk_data["model"]
                            except (json.JSONDecodeError, IndexError, KeyError):
                                continue
            latency = (time.time() - start_time) * 1000
            yield f'data: {json.dumps({"type": "done", "latency_ms": round(latency, 2), "model": model_name}, ensure_ascii=False)}\n\n'
        except Exception as e:
            yield f'data: {json.dumps({"type": "error", "message": str(e)[:300]}, ensure_ascii=False)}\n\n'


# ---------------------------------------------------------------------------
# 提供商模板（数据驱动，替代硬编码 Provider 类映射）
# ---------------------------------------------------------------------------

def _provider_template(
    *,
    display_name: str,
    default_base_url: str,
    default_model: str,
    available_models: List[str],
    requires_extra_headers: bool = False,
    extra_header_keys: Optional[List[str]] = None,
    extra_headers: Optional[Dict[str, str]] = None,
    tool_calling: bool = False,
    reasoning: bool = False,
    long_output: bool = True,
) -> Dict[str, Any]:
    return {
        "display_name": display_name,
        "default_base_url": default_base_url,
        "default_model": default_model,
        "available_models": available_models,
        "requires_extra_headers": requires_extra_headers,
        "extra_header_keys": extra_header_keys or [],
        "extra_headers": extra_headers or {},
        "default_max_tokens": settings.AI_DEFAULT_MAX_TOKENS,
        "capabilities": {
            "streaming": True,
            "tool_calling": tool_calling,
            "reasoning": reasoning,
            "long_output": long_output,
        },
    }


PROVIDER_TEMPLATES: Dict[str, Dict[str, Any]] = {
    "deepseek": _provider_template(
        display_name="DeepSeek",
        default_base_url="https://api.deepseek.com/v1",
        default_model="deepseek-chat",
        available_models=["deepseek-chat", "deepseek-reasoner"],
        tool_calling=True,
        reasoning=True,
    ),
    "zhipu": _provider_template(
        display_name="Zhipu AI (GLM)",
        default_base_url="https://open.bigmodel.cn/api/paas/v4",
        default_model="glm-4-flash",
        available_models=["glm-4-flash", "glm-4-air", "glm-4", "glm-4-long"],
        tool_calling=True,
        reasoning=True,
    ),
    "qwen": _provider_template(
        display_name="Qwen",
        default_base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        default_model="qwen-turbo",
        available_models=["qwen-turbo", "qwen-plus", "qwen-max", "qwen-long"],
        tool_calling=True,
        reasoning=True,
    ),
    "xinghuo": _provider_template(
        display_name="Xinghuo",
        default_base_url="https://spark-api-open.xf-yun.com/v1",
        default_model="generalv3.5",
        available_models=["generalv3.5", "generalv3", "lite", "x1"],
    ),
    "wenxin": _provider_template(
        display_name="Wenxin",
        default_base_url="https://qianfan.baidubce.com/v2",
        default_model="ernie-4.0-8k",
        available_models=["ernie-4.0-8k", "ernie-3.5-8k", "ernie-lite-8k"],
        reasoning=True,
    ),
    "moonshot": _provider_template(
        display_name="Kimi (Moonshot)",
        default_base_url="https://api.moonshot.cn/v1",
        default_model="moonshot-v1-32k",
        available_models=["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
        reasoning=True,
        long_output=True,
    ),
    "siliconflow": _provider_template(
        display_name="SiliconFlow (硅基流动)",
        default_base_url="https://api.siliconflow.cn/v1",
        default_model="Qwen/Qwen2.5-7B-Instruct",
        available_models=[
            "Qwen/Qwen2.5-7B-Instruct",
            "Qwen/Qwen2.5-72B-Instruct",
            "Qwen/Qwen3-8B",
            "Qwen/Qwen3-30B-A3B",
            "deepseek-ai/DeepSeek-V3",
            "deepseek-ai/DeepSeek-R1",
            "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B",
            "THUDM/glm-4-9b-chat",
            "meta-llama/Meta-Llama-3.1-8B-Instruct",
            "meta-llama/Meta-Llama-3.1-70B-Instruct",
            "Pro/Qwen/Qwen2.5-7B-Instruct",
            "Pro/deepseek-ai/DeepSeek-V3",
            "Pro/deepseek-ai/DeepSeek-R1",
        ],
        tool_calling=True,
        reasoning=True,
        long_output=True,
    ),
    "openrouter": _provider_template(
        display_name="OpenRouter",
        default_base_url="https://openrouter.ai/api/v1",
        default_model="",
        available_models=[],
        requires_extra_headers=True,
        extra_header_keys=["HTTP-Referer", "X-Title"],
        tool_calling=True,
        reasoning=True,
        long_output=True,
    ),
    "openai_compat": _provider_template(
        display_name="OpenAI Compatible",
        default_base_url="",
        default_model="",
        available_models=[],
    ),
}

# 向后兼容别名（DB 中的旧 provider_name → 新模板 key）
PROVIDER_ALIASES: Dict[str, str] = {
    "chatglm": "zhipu",
    "kimi": "moonshot",
    "glm": "zhipu",
    "xfy": "xinghuo",
    "xfyun": "xinghuo",
    # 中文名称映射
    "星火": "xinghuo",
    "讯飞星火": "xinghuo",
    "智谱清言": "zhipu",
    "智谱": "zhipu",
    "文心一言": "wenxin",
    "百度千帆": "wenxin",
    "通义千问": "qwen",
    "月之暗面": "moonshot",
    "Kimi": "moonshot",
    "DeepSeek": "deepseek",
    # 硅基流动
    "硅基流动": "siliconflow",
    "SiliconFlow": "siliconflow",
}


class ModelRegistry:
    """模型注册表（单例）"""

    _instance = None
    _providers: Dict[str, AIProvider] = {}
    _provider_params: Dict[str, Dict[str, Any]] = {}
    _cache: Dict[str, Any] = {}
    _cache_ttl: int = 300  # 5分钟

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def register_provider(self, name: str, provider: AIProvider, params: Optional[Dict[str, Any]] = None):
        """注册提供商"""
        self._providers[name] = provider
        self._provider_params[name] = params or {}
        logger.info(f"已注册AI提供商: {name}")

    def get_provider(self, name: str) -> Optional[AIProvider]:
        """获取提供商"""
        return self._providers.get(name)

    def load_from_db(self, db: Session):
        """从数据库加载配置"""
        configs = ModelConfigRepository.get_all_enabled(db)
        self._providers.clear()
        self._provider_params.clear()

        for config in configs:
            try:
                provider = self.build_provider_from_config(config)
                if provider:
                    self.register_provider(config.provider_name, provider)
                    logger.info("从数据库加载提供商: %s", config.provider_name)
            except Exception as e:  # pylint: disable=broad-except
                logger.error("加载提供商 %s 失败: %s", config.provider_name, e)

    def call_with_fallback(
        self,
        messages: List[Dict[str, str]],
        preferred_provider: Optional[str] = None,
        allow_fallback: bool = True,
        **kwargs,
    ) -> Dict[str, Any]:
        """调用AI，支持fallback"""
        # 获取启用的提供商列表（按优先级排序）
        providers = list(self._providers.keys())

        if preferred_provider:
            if preferred_provider not in providers:
                raise ValueError(f"未启用的模型: {preferred_provider}")
            providers = [preferred_provider] + [p for p in providers if p != preferred_provider]
            if not allow_fallback:
                providers = [preferred_provider]
        elif not providers:
            raise ValueError("未配置任何可用模型")

        last_error = None
        error_details = []

        for provider_name in providers:
            try:
                provider = self._providers[provider_name]
                default_params = self._provider_params.get(provider_name, {})
                call_kwargs = {**default_params, **kwargs}
                start_time = time.time()
                result = provider.call(messages, **call_kwargs)
                latency = (time.time() - start_time) * 1000

                result["provider"] = provider_name
                result["latency_ms"] = latency
                logger.info(f"AI调用成功: {provider_name}, 延迟: {latency:.2f}ms")
                return result
            except httpx.HTTPStatusError as e:
                status_code = e.response.status_code
                error_msg = self._parse_http_error(provider_name, status_code, e.response)
                error_details.append({"provider": provider_name, "error": error_msg})
                last_error = error_msg
                logger.warning(f"AI调用失败: {provider_name}, 错误: {error_msg}")
                continue
            except httpx.HTTPError as e:
                error_msg = f"{provider_name} 网络连接失败，请检查网络或稍后重试"
                error_details.append({"provider": provider_name, "error": error_msg})
                last_error = error_msg
                logger.warning(f"AI调用失败: {provider_name}, 网络错误: {e}")
                continue
            except Exception as e:
                error_str = str(e)
                if "400" in error_str or "Bad Request" in error_str:
                    error_msg = f"{provider_name} API 密钥无效或请求参数错误"
                elif "401" in error_str or "Unauthorized" in error_str:
                    error_msg = f"{provider_name} 认证失败，请检查 API 密钥"
                elif "429" in error_str or "Too Many Requests" in error_str:
                    error_msg = f"{provider_name} 请求过于频繁，请稍后重试"
                elif "500" in error_str or "Internal Server Error" in error_str:
                    error_msg = f"{provider_name} 服务器错误，请稍后重试"
                elif "503" in error_str or "Service Unavailable" in error_str:
                    error_msg = f"{provider_name} 服务暂时不可用"
                else:
                    error_msg = f"{provider_name} 调用失败: {error_str[:100]}"

                error_details.append({"provider": provider_name, "error": error_msg})
                last_error = error_msg
                logger.warning(f"AI调用失败: {provider_name}, 错误: {e}")
                continue

        raise Exception(self._build_friendly_error(error_details))

    def _parse_http_error(self, provider_name: str, status_code: int, response) -> str:
        """解析 HTTP 错误为友好提示"""
        try:
            error_data = response.json()
            detail = error_data.get("error", {}).get("message", "") or error_data.get("message", "")
        except Exception:
            detail = ""

        if status_code == 400:
            if "invalid" in detail.lower() or "api" in detail.lower():
                return f"{provider_name} API 密钥无效或已过期"
            return f"{provider_name} 请求参数错误"
        elif status_code == 401:
            return f"{provider_name} 认证失败，请检查 API 密钥"
        elif status_code == 403:
            return f"{provider_name} 无权限访问，请检查账户状态"
        elif status_code == 429:
            return f"{provider_name} 请求过于频繁，请稍后重试"
        elif status_code == 500:
            return f"{provider_name} 服务器错误，请稍后重试"
        elif status_code == 503:
            return f"{provider_name} 服务暂时不可用"
        else:
            return f"{provider_name} 调用失败 (HTTP {status_code})"

    def _build_friendly_error(self, error_details: List[Dict]) -> str:
        """构建友好的错误提示"""
        if not error_details:
            return "AI 服务调用失败，请稍后重试"

        auth_errors = [e for e in error_details if "认证" in e["error"] or "密钥" in e["error"]]
        rate_errors = [e for e in error_details if "频繁" in e["error"]]
        server_errors = [e for e in error_details if "服务器" in e["error"] or "不可用" in e["error"]]

        if len(auth_errors) == len(error_details):
            return "所有 AI 模型的 API 密钥配置有误，请前往管理后台检查配置"
        elif len(rate_errors) > 0:
            return "AI 服务请求过于频繁，请稍后重试"
        elif len(server_errors) > 0:
            return "AI 服务暂时不可用，请稍后重试"
        else:
            return f"AI 调用失败：{error_details[0]['error']}"

    def call_with_function_calling(
        self,
        messages: List[Dict[str, str]],
        tools: List[Dict[str, Any]],
        preferred_provider: Optional[str] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        """调用支持 Function Calling 的 AI 模型"""
        fc_providers = ["deepseek", "zhipu", "qwen"]

        providers = list(self._providers.keys())

        if preferred_provider and preferred_provider in providers:
            providers = [preferred_provider] + [p for p in providers if p != preferred_provider]
        else:
            fc_available = [p for p in fc_providers if p in providers]
            other_providers = [p for p in providers if p not in fc_providers]
            providers = fc_available + other_providers

        if not providers:
            raise ValueError("未配置任何可用模型")

        last_error = None
        for provider_name in providers:
            try:
                provider = self._providers[provider_name]
                default_params = self._provider_params.get(provider_name, {})

                if hasattr(provider, "call_with_tools"):
                    result = provider.call_with_tools(messages, tools, **kwargs)
                else:
                    logger.warning(f"{provider_name} 不支持原生 Function Calling，降级到 ReAct")
                    raise Exception(f"{provider_name} 不支持 Function Calling")

                result["provider"] = provider_name
                logger.info(f"Function Calling 调用成功: {provider_name}")
                return result

            except Exception as e:
                last_error = e
                logger.warning(f"Function Calling 调用失败: {provider_name}, 错误: {e}")
                continue

        raise Exception(f"所有 Function Calling 提供商调用失败，最后错误: {last_error}")

    def build_provider_from_config(self, config) -> Optional[OpenAICompatProvider]:
        """根据模型配置创建 OpenAICompatProvider 实例"""
        # 解析别名（向后兼容旧 DB 记录）
        normalized = self._normalize_provider_name(config.provider_name)
        template = PROVIDER_TEMPLATES.get(normalized, PROVIDER_TEMPLATES["openai_compat"])

        api_key = decrypt_api_key(config.api_key) if config.api_key else ""
        if not api_key:
            return None

        params: Dict[str, Any] = config.params if isinstance(config.params, dict) else {}
        # 兼容 DB 中 model_name / model 两种键名
        model_name = params.get("model_name") or params.get("model") or template.get("default_model") or ""

        # 优先使用 DB 存储的 base_url，其次使用模板默认值
        base_url: str = config.base_url or template.get("default_base_url", "")

        # 自动去除末尾的 /chat/completions（DB 中旧数据可能已包含该路径）
        if base_url.endswith("/chat/completions"):
            base_url = base_url[: -len("/chat/completions")]

        # 自动升级旧版 Qwen 非兼容接口
        if normalized == "qwen" and base_url and "compatible-mode" not in base_url:
            logger.warning(
                "Qwen 旧版接口已自动升级为 OpenAI 兼容模式: %s -> %s",
                base_url,
                "https://dashscope.aliyuncs.com/compatible-mode/v1",
            )
            base_url = "https://dashscope.aliyuncs.com/compatible-mode/v1"

        # 合并模板 extra_headers 与用户自定义 extra_headers（用户优先），过滤空值
        template_extra = template.get("extra_headers", {})
        param_extra = params.get("extra_headers") or {}
        extra_headers = {**template_extra, **param_extra}
        extra_headers = {k: v for k, v in extra_headers.items() if v}

        return OpenAICompatProvider(
            api_key=api_key,
            base_url=base_url,
            model_name=model_name,
            temperature=float(params.get("temperature", 0.7)),
            max_tokens=int(params.get("max_tokens", template.get("default_max_tokens", settings.AI_DEFAULT_MAX_TOKENS))),
            top_p=float(params.get("top_p", 1.0)),
            extra_headers=extra_headers,
            timeout=int(params.get("timeout", 60)),
        )

    @staticmethod
    def _normalize_provider_name(name: str) -> str:
        raw = (name or "").strip()
        lower = raw.lower()
        return PROVIDER_ALIASES.get(raw, PROVIDER_ALIASES.get(lower, lower))


# 全局注册表实例
registry = ModelRegistry()
