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
from core.exceptions import UpstreamServiceError
from core.logger import logger
from core.config import settings
from core.security import decrypt_api_key
from sqlalchemy.orm import Session
from repositories.model_config_repo import ModelConfigRepository
import threading


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
        # Keep the provider payload normalized here so different vendors can
        # share one request path and one fallback contract upstream.
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
                                    # Normalize every provider stream to the same SSE token event
                                    # so the frontend only needs to handle one format.
                                    yield f'data: {json.dumps({"type": "token", "content": content}, ensure_ascii=False)}\n\n'
                                if chunk_data.get("model"):
                                    model_name = chunk_data["model"]
                            except (json.JSONDecodeError, IndexError, KeyError):
                                continue
            latency = (time.time() - start_time) * 1000
            yield f'data: {json.dumps({"type": "done", "latency_ms": round(latency, 2), "model": model_name}, ensure_ascii=False)}\n\n'
        except Exception as e:
            yield f'data: {json.dumps({"type": "error", "message": str(e)[:300]}, ensure_ascii=False)}\n\n'


class WenxinProvider(AIProvider):
    """百度文心一言专用提供商（千帆 V2 API，OAuth2 access_token 认证）"""

    _TOKEN_URL = "https://aip.baidubce.com/oauth/2.0/token"

    def __init__(
        self,
        api_key: str,
        secret_key: str,
        base_url: str,
        model_name: str,
        temperature: float = 0.7,
        max_tokens: int = settings.AI_DEFAULT_MAX_TOKENS,
        top_p: float = 1.0,
        timeout: int = 60,
    ):
        self.api_key = api_key
        self.secret_key = secret_key
        self.base_url = base_url.rstrip("/")
        self.model_name = model_name
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.top_p = top_p
        self.timeout = timeout
        self._access_token: Optional[str] = None
        self._token_expires_at: float = 0.0
        self._token_lock = threading.Lock()

    def _get_access_token(self) -> str:
        with self._token_lock:
            if self._access_token and time.time() < self._token_expires_at:
                return self._access_token
            params = {
                "grant_type": "client_credentials",
                "client_id": self.api_key,
                "client_secret": self.secret_key,
            }
            with httpx.Client(timeout=15) as client:
                resp = client.post(self._TOKEN_URL, params=params)
                resp.raise_for_status()
                data = resp.json()
            if "error" in data:
                raise RuntimeError(f"百度 OAuth2 获取 token 失败: {data.get('error_description', data['error'])}")
            self._access_token = data["access_token"]
            # 提前 60 秒刷新，避免边界问题
            self._token_expires_at = time.time() + int(data.get("expires_in", 2592000)) - 60
            return self._access_token

    def _build_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self._get_access_token()}",
            "Content-Type": "application/json",
        }

    def call(self, messages: List[Dict[str, str]], **kwargs) -> Dict[str, Any]:
        headers = self._build_headers()
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
        try:
            headers = self._build_headers()
        except Exception as e:
            yield f'data: {json.dumps({"type": "error", "message": str(e)[:300]}, ensure_ascii=False)}\n\n'
            return

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
    default_max_tokens: Optional[int] = None,
) -> Dict[str, Any]:
    return {
        "display_name": display_name,
        "default_base_url": default_base_url,
        "default_model": default_model,
        "available_models": available_models,
        "requires_extra_headers": requires_extra_headers,
        "extra_header_keys": extra_header_keys or [],
        "extra_headers": extra_headers or {},
        "default_max_tokens": default_max_tokens if default_max_tokens is not None else settings.AI_DEFAULT_MAX_TOKENS,
        "capabilities": {
            "streaming": True,
            "tool_calling": tool_calling,
            "reasoning": reasoning,
            "long_output": long_output,
        },
    }


# AI辅助生成: DeepSeek-V3 2025-12 — Provider注册工厂结构与httpx请求实现
# Prompt: "我正在开发一个支持多AI提供商的学习平台，需要一个统一的Provider注册..."
# 修改: 增加了PROVIDER_ALIASES别名反向查找、call_with_fallback()容错逻辑、加密密钥解密集成
PROVIDER_TEMPLATES: Dict[str, Dict[str, Any]] = {
    "deepseek": _provider_template(
        display_name="DeepSeek",
        default_base_url="https://api.deepseek.com/v1",
        default_model="deepseek-chat",
        default_max_tokens=8192,
        available_models=["deepseek-chat", "deepseek-reasoner"],
        tool_calling=True,
        reasoning=True,
    ),
    "zhipu": _provider_template(
        display_name="智谱AI",
        default_base_url="https://open.bigmodel.cn/api/paas/v4",
        default_model="glm-4-flash",
        available_models=["glm-4.7-flash", "glm-4-flash", "glm-4-air", "glm-4", "glm-4-long", "glm-z1-flash", "glm-z1-air"],
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
        display_name="月之暗面",
        default_base_url="https://api.moonshot.cn/v1",
        default_model="moonshot-v1-32k",
        available_models=["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
        reasoning=True,
        long_output=True,
    ),
    "siliconflow": _provider_template(
        display_name="硅基流动",
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
    _provider_aliases: Dict[str, str] = {}
    _cache: Dict[str, Any] = {}
    _cache_ttl: int = 300  # 5分钟

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def register_provider(
        self,
        name: str,
        provider: AIProvider,
        params: Optional[Dict[str, Any]] = None,
        aliases: Optional[List[str]] = None,
    ):
        """注册提供商"""
        canonical_name = self._normalize_provider_name(name)
        self._providers[canonical_name] = provider
        self._provider_params[canonical_name] = params or {}
        self._provider_aliases[canonical_name] = canonical_name

        raw_name = (name or "").strip()
        if raw_name:
            self._provider_aliases[raw_name] = canonical_name

        for alias in aliases or []:
            alias_name = (str(alias) if alias is not None else "").strip()
            if not alias_name:
                continue
            self._provider_aliases[alias_name] = canonical_name
            normalized_alias = self._normalize_provider_name(alias_name)
            self._provider_aliases[normalized_alias] = canonical_name

        logger.info(f"已注册AI提供商: {canonical_name}")

    def get_provider(self, name: str) -> Optional[AIProvider]:
        """获取提供商"""
        resolved_name = self._resolve_provider_name(name)
        return self._providers.get(resolved_name)

    def load_from_db(self, db: Session):
        """从数据库加载配置"""
        configs = ModelConfigRepository.get_all_enabled(db)
        self._providers.clear()
        self._provider_params.clear()
        self._provider_aliases.clear()

        for config in configs:
            try:
                provider = self.build_provider_from_config(config)
                if provider:
                    normalized_name = self._normalize_provider_name(config.provider_name)
                    self.register_provider(
                        normalized_name,
                        provider,
                        aliases=[str(config.id), config.provider_name],
                    )
                    logger.info("从数据库加载提供商: %s (id=%s)", config.provider_name, config.id)
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
            preferred_provider = self._resolve_provider_name(preferred_provider)
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
                error_msg, category = self._parse_http_error(
                    provider_name, status_code, e.response
                )
                error_details.append(
                    {
                        "provider": provider_name,
                        "error": error_msg,
                        "status_code": status_code,
                        "category": category,
                    }
                )
                last_error = error_msg
                logger.warning(f"AI调用失败: {provider_name}, 错误: {error_msg}")
                continue
            except httpx.HTTPError as e:
                error_msg = f"{provider_name} 网络连接失败，请检查网络或稍后重试"
                error_details.append(
                    {
                        "provider": provider_name,
                        "error": error_msg,
                        "status_code": None,
                        "category": "network",
                    }
                )
                last_error = error_msg
                logger.warning(f"AI调用失败: {provider_name}, 网络错误: {e}")
                continue
            except Exception as e:
                error_msg, status_code, category = self._classify_generic_error(
                    provider_name, str(e)
                )
                error_details.append(
                    {
                        "provider": provider_name,
                        "error": error_msg,
                        "status_code": status_code,
                        "category": category,
                    }
                )
                last_error = error_msg
                logger.warning(f"AI调用失败: {provider_name}, 错误: {e}")
                continue

        raise self._build_upstream_error(error_details)

    def _parse_http_error(
        self, provider_name: str, status_code: int, response
    ) -> Tuple[str, str]:
        """解析 HTTP 错误为友好提示"""
        try:
            error_data = response.json()
            detail = error_data.get("error", {}).get("message", "") or error_data.get("message", "")
        except Exception:
            detail = ""
        detail_lower = detail.lower()

        if status_code == 400:
            if any(token in detail_lower for token in ["invalid", "api", "key", "token"]):
                return f"{provider_name} API 密钥无效或已过期", "auth"
            return f"{provider_name} 请求参数错误", "bad_request"
        elif status_code == 401:
            return f"{provider_name} 认证失败，请检查 API 密钥", "auth"
        elif status_code == 403:
            return f"{provider_name} 无权限访问，请检查账户状态", "auth"
        elif status_code == 429:
            return f"{provider_name} 请求过于频繁，请稍后重试", "rate_limit"
        elif status_code in (500, 502, 503, 504):
            return f"{provider_name} 服务暂时不可用", "upstream_server"
        else:
            return f"{provider_name} 调用失败 (HTTP {status_code})", "other"

    def _classify_generic_error(
        self, provider_name: str, error_str: str
    ) -> Tuple[str, Optional[int], str]:
        """兜底解析非 HTTPStatusError 异常。"""
        if "401" in error_str or "Unauthorized" in error_str:
            return f"{provider_name} 认证失败，请检查 API 密钥", 401, "auth"
        if "403" in error_str or "Forbidden" in error_str:
            return f"{provider_name} 无权限访问，请检查账户状态", 403, "auth"
        if "429" in error_str or "Too Many Requests" in error_str:
            return f"{provider_name} 请求过于频繁，请稍后重试", 429, "rate_limit"
        if "503" in error_str or "Service Unavailable" in error_str:
            return f"{provider_name} 服务暂时不可用", 503, "upstream_server"
        if "500" in error_str or "502" in error_str or "504" in error_str:
            return f"{provider_name} 服务暂时不可用", 500, "upstream_server"
        if "400" in error_str or "Bad Request" in error_str:
            return f"{provider_name} 请求参数错误", 400, "bad_request"
        return f"{provider_name} 调用失败: {error_str[:100]}", None, "other"

    def _build_upstream_error(self, error_details: List[Dict[str, Any]]) -> UpstreamServiceError:
        """将上游错误聚合成可返回给路由层的异常。"""
        if not error_details:
            return UpstreamServiceError(
                "AI 服务调用失败，请稍后重试",
                http_status=503,
            )

        first_error = error_details[0]
        auth_errors = [e for e in error_details if e.get("category") == "auth"]
        rate_errors = [e for e in error_details if e.get("category") == "rate_limit"]
        network_errors = [e for e in error_details if e.get("category") == "network"]
        server_errors = [
            e for e in error_details if e.get("category") == "upstream_server"
        ]
        bad_request_errors = [
            e for e in error_details if e.get("category") == "bad_request"
        ]

        if auth_errors and len(auth_errors) == len(error_details):
            upstream_status = self._first_status_code(auth_errors) or 401
            return UpstreamServiceError(
                f"AI 上游认证失败（上游 HTTP {upstream_status}），请检查管理后台 API Key 配置",
                http_status=502,
                upstream_status=upstream_status,
                provider=auth_errors[0].get("provider"),
            )

        if rate_errors:
            upstream_status = self._first_status_code(rate_errors) or 429
            return UpstreamServiceError(
                f"AI 上游限流（上游 HTTP {upstream_status}），请稍后重试",
                http_status=503,
                upstream_status=upstream_status,
                provider=rate_errors[0].get("provider"),
            )

        if network_errors and len(network_errors) == len(error_details):
            return UpstreamServiceError(
                "AI 上游连接失败，请稍后重试",
                http_status=503,
                provider=network_errors[0].get("provider"),
            )

        if server_errors:
            upstream_status = self._first_status_code(server_errors) or 503
            http_status = 503 if upstream_status == 503 else 502
            return UpstreamServiceError(
                f"AI 上游服务异常（上游 HTTP {upstream_status}），请稍后重试",
                http_status=http_status,
                upstream_status=upstream_status,
                provider=server_errors[0].get("provider"),
            )

        if bad_request_errors and len(bad_request_errors) == len(error_details):
            upstream_status = self._first_status_code(bad_request_errors) or 400
            return UpstreamServiceError(
                f"AI 上游请求失败（上游 HTTP {upstream_status}），请检查模型配置或稍后重试",
                http_status=502,
                upstream_status=upstream_status,
                provider=bad_request_errors[0].get("provider"),
            )

        upstream_status = first_error.get("status_code")
        status_suffix = f"（上游 HTTP {upstream_status}）" if upstream_status else ""
        return UpstreamServiceError(
            f"AI 调用失败{status_suffix}：{first_error['error']}",
            http_status=502,
            upstream_status=upstream_status,
            provider=first_error.get("provider"),
        )

    @staticmethod
    def _first_status_code(error_details: List[Dict[str, Any]]) -> Optional[int]:
        for detail in error_details:
            if detail.get("status_code") is not None:
                return int(detail["status_code"])
        return None

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

        if preferred_provider:
            preferred_provider = self._resolve_provider_name(preferred_provider)

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

    def build_provider_from_config(self, config) -> Optional[AIProvider]:
        """根据模型配置创建 Provider 实例"""
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

        # 百度文心专用 Provider（OAuth2 token 认证）
        if normalized == "wenxin":
            # 新版 IAM key（bce-v3/... 格式）直接用 Bearer 认证，无需 OAuth2
            if api_key.startswith("bce-v3/"):
                return OpenAICompatProvider(
                    api_key=api_key,
                    base_url=base_url,
                    model_name=model_name,
                    temperature=float(params.get("temperature", 0.7)),
                    max_tokens=int(params.get("max_tokens", template.get("default_max_tokens", settings.AI_DEFAULT_MAX_TOKENS))),
                    top_p=float(params.get("top_p", 1.0)),
                    extra_headers={},
                    timeout=int(params.get("timeout", 120)),
                )
            # 旧版 OAuth2 格式：支持 "APIKEY:SECRETKEY" 合并填写（冒号分隔），兼容仅填 api_key + params.secret_key
            if ":" in api_key:
                api_key, secret_key = api_key.split(":", 1)
            else:
                secret_key = params.get("secret_key", "")
            return WenxinProvider(
                api_key=api_key,
                secret_key=secret_key,
                base_url=base_url,
                model_name=model_name,
                temperature=float(params.get("temperature", 0.7)),
                max_tokens=int(params.get("max_tokens", template.get("default_max_tokens", settings.AI_DEFAULT_MAX_TOKENS))),
                top_p=float(params.get("top_p", 1.0)),
                timeout=int(params.get("timeout", 120)),
            )

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
            timeout=int(params.get("timeout", 120)),
        )

    @staticmethod
    def _normalize_provider_name(name: str) -> str:
        raw = (name or "").strip()
        lower = raw.lower()
        return PROVIDER_ALIASES.get(raw, PROVIDER_ALIASES.get(lower, lower))

    def _resolve_provider_name(self, name: Optional[str]) -> Optional[str]:
        raw = (name or "").strip()
        if not raw:
            return raw
        if raw in self._providers:
            return raw
        if raw in self._provider_aliases:
            return self._provider_aliases[raw]

        normalized = self._normalize_provider_name(raw)
        if normalized in self._providers:
            return normalized
        if normalized in self._provider_aliases:
            return self._provider_aliases[normalized]
        return normalized


# 全局注册表实例
registry = ModelRegistry()
