"""
模型注册表
作者：智学伴开发团队
目的：统一管理各AI提供商的调用方法，支持fallback策略
环境变量：从数据库读取（ModelConfig表）
测试：pytest backend/tests/test_model_registry.py
"""
import time
import httpx
from typing import Optional, Dict, Any, List, Tuple
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


class DeepSeekProvider(AIProvider):
    """DeepSeek提供商"""
    
    def __init__(self, api_key: str, base_url: Optional[str] = None):
        self.api_key = api_key
        self.base_url = base_url or "https://api.deepseek.com/v1/chat/completions"
    
    def call(self, messages: List[Dict[str, str]], **kwargs) -> Dict[str, Any]:
        """调用DeepSeek API"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": kwargs.get("model", "deepseek-chat"),
            "messages": messages,
            "temperature": kwargs.get("temperature", 0.7),
            "max_tokens": kwargs.get("max_tokens", 2000)
        }
        
        with httpx.Client(timeout=settings.AI_TIMEOUT) as client:
            response = client.post(self.base_url, json=payload, headers=headers)
            response.raise_for_status()
            result = response.json()
            return {
                "text": result["choices"][0]["message"]["content"],
                "usage": result.get("usage", {}),
                "model": result.get("model", "deepseek-chat")
            }


class QwenProvider(AIProvider):
    """通义千问提供商"""
    
    def __init__(self, api_key: str, base_url: Optional[str] = None):
        self.api_key = api_key
        self.base_url = base_url or "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation"
    
    def call(self, messages: List[Dict[str, str]], **kwargs) -> Dict[str, Any]:
        """调用Qwen API"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        qwen_messages = [{"role": msg["role"], "content": msg["content"]} for msg in messages]
        
        payload = {
            "model": kwargs.get("model", "qwen-turbo"),
            "input": {
                "messages": qwen_messages
            },
            "parameters": {
                "temperature": kwargs.get("temperature", 0.7),
                "max_tokens": kwargs.get("max_tokens", 2000)
            }
        }
        
        with httpx.Client(timeout=settings.AI_TIMEOUT) as client:
            response = client.post(self.base_url, json=payload, headers=headers)
            response.raise_for_status()
            result = response.json()
            return {
                "text": result["output"]["choices"][0]["message"]["content"],
                "usage": result.get("usage", {}),
                "model": result.get("model", payload["model"])
            }


class ChatGLMProvider(AIProvider):
    """ChatGLM提供商"""
    
    def __init__(self, api_key: str, base_url: Optional[str] = None):
        self.api_key = api_key
        self.base_url = base_url or "https://open.bigmodel.cn/api/paas/v4/chat/completions"
    
    def call(self, messages: List[Dict[str, str]], **kwargs) -> Dict[str, Any]:
        """调用ChatGLM API"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": kwargs.get("model", "glm-4"),
            "messages": messages,
            "temperature": kwargs.get("temperature", 0.7),
            "max_tokens": kwargs.get("max_tokens", 2000)
        }
        
        with httpx.Client(timeout=settings.AI_TIMEOUT) as client:
            response = client.post(self.base_url, json=payload, headers=headers)
            response.raise_for_status()
            result = response.json()
            return {
                "text": result["choices"][0]["message"]["content"],
                "usage": result.get("usage", {}),
                "model": result.get("model", "glm-4")
            }


class WenxinProvider(AIProvider):
    """文心一言提供商"""
    
    def __init__(self, api_key: str, base_url: Optional[str] = None):
        self.api_key = api_key
        self.base_url = base_url or "https://qianfan.baidubce.com/v2/chat/completions"
    
    def call(self, messages: List[Dict[str, str]], **kwargs) -> Dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": kwargs.get("model", "ernie-lite-8k"),
            "messages": messages,
            "temperature": kwargs.get("temperature", 0.7),
            "max_output_tokens": kwargs.get("max_tokens", 2000)
        }
        with httpx.Client(timeout=settings.AI_TIMEOUT) as client:
            response = client.post(self.base_url, json=payload, headers=headers)
            response.raise_for_status()
            result = response.json()
            text = result.get("result")
            if not text and "choices" in result:
                text = result["choices"][0]["message"]["content"]
            return {
                "text": text,
                "usage": result.get("usage", {}),
                "model": result.get("model", payload["model"])
            }


class XinghuoProvider(AIProvider):
    """讯飞星火提供商"""
    
    def __init__(self, api_key: str, base_url: Optional[str] = None):
        self.api_key = api_key
        self.base_url = base_url or "https://spark-api.xf-yun.com/v1/chat/completions"
    
    def call(self, messages: List[Dict[str, str]], **kwargs) -> Dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": kwargs.get("model", "general"),
            "messages": messages,
            "temperature": kwargs.get("temperature", 0.7),
            "max_tokens": kwargs.get("max_tokens", 2000)
        }
        with httpx.Client(timeout=settings.AI_TIMEOUT) as client:
            response = client.post(self.base_url, json=payload, headers=headers)
            response.raise_for_status()
            result = response.json()
            text = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            return {
                "text": text,
                "usage": result.get("usage", {}),
                "model": result.get("model", payload["model"])
            }


class MoonshotProvider(AIProvider):
    """Moonshot(Kimi)提供商"""
    
    def __init__(self, api_key: str, base_url: Optional[str] = None):
        self.api_key = api_key
        self.base_url = base_url or "https://api.moonshot.cn/v1/chat/completions"
    
    def call(self, messages: List[Dict[str, str]], **kwargs) -> Dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": kwargs.get("model", "moonshot-v1-32k"),
            "messages": messages,
            "temperature": kwargs.get("temperature", 0.7),
            "max_tokens": kwargs.get("max_tokens", 2000)
        }
        with httpx.Client(timeout=settings.AI_TIMEOUT) as client:
            response = client.post(self.base_url, json=payload, headers=headers)
            response.raise_for_status()
            result = response.json()
            return {
                "text": result["choices"][0]["message"]["content"],
                "usage": result.get("usage", {}),
                "model": result.get("model", payload["model"])
            }


PROVIDER_CLASS_MAP = {
    "deepseek": DeepSeekProvider,
    "qwen": QwenProvider,
    "chatglm": ChatGLMProvider,
    "xfy": XinghuoProvider,
    "xinghuo": XinghuoProvider,
    "wenxin": WenxinProvider,
    "moonshot": MoonshotProvider,
    "kimi": MoonshotProvider,
}

PROVIDER_ALIAS_MAP = {
    "通义千问": "qwen",
    "qwen": "qwen",
    "阿里通义": "qwen",
    "chatglm": "chatglm",
    "glm": "chatglm",
    "智谱清言": "chatglm",
    "清言": "chatglm",
    "文心一言": "wenxin",
    "文心": "wenxin",
    "百度文心": "wenxin",
    "ernie": "wenxin",
    "星火": "xinghuo",
    "讯飞星火": "xinghuo",
    "科大讯飞": "xinghuo",
    "xfyun": "xinghuo",
    "kimi": "kimi",
    "moonshot": "moonshot",
    "deepseek": "deepseek",
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
                provider_bundle = self.build_provider_from_config(config)
                if provider_bundle:
                    provider, params = provider_bundle
                    self.register_provider(config.provider_name, provider, params)
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
            except Exception as e:
                last_error = e
                logger.warning(f"AI调用失败: {provider_name}, 错误: {e}")
                continue
        
        # 所有提供商都失败
        raise Exception(f"所有AI提供商调用失败，最后错误: {last_error}")

    def build_provider_from_config(
        self, config
    ) -> Optional[Tuple[AIProvider, Dict[str, Any]]]:
        """根据模型配置创建 provider 实例及默认参数"""
        normalized_name = self._normalize_provider_name(config.provider_name)
        provider_class = PROVIDER_CLASS_MAP.get(normalized_name)
        if not provider_class:
            return None
        api_key = decrypt_api_key(config.api_key) if config.api_key else ""
        if not api_key:
            return None
        provider = provider_class(api_key, config.base_url)
        params = config.params if isinstance(config.params, dict) else {}
        return provider, params

    @staticmethod
    def _normalize_provider_name(name: str) -> str:
        raw = (name or "").strip()
        lower = raw.lower()
        return PROVIDER_ALIAS_MAP.get(raw, PROVIDER_ALIAS_MAP.get(lower, lower))


# 全局注册表实例
registry = ModelRegistry()

