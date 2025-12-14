"""
模型提供商调用单元测试
作者：智学伴开发团队
目的：确保新增的文心 / 星火 / Moonshot 提供商能够正确构造请求并解析响应
运行：pytest backend/tests/test_model_registry_providers.py -v
"""
import pytest

from utils.model_registry import (
    WenxinProvider,
    XinghuoProvider,
    MoonshotProvider,
    registry,
    AIProvider,
)


class DummyResponse:
    """模拟 httpx.Response 对象"""

    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


def patch_httpx(monkeypatch, expected_payload, capture):
    """替换 httpx.Client 以拦截请求"""

    class DummyClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc_val, exc_tb):
            return False

        def post(self, url, json=None, headers=None):
            capture["url"] = url
            capture["json"] = json
            capture["headers"] = headers
            return DummyResponse(expected_payload)

    monkeypatch.setattr("utils.model_registry.httpx.Client", lambda *args, **kwargs: DummyClient())


def test_wenxin_provider_parses_result(monkeypatch):
    capture = {}
    payload = {"result": "文心回答", "usage": {"total_tokens": 42}, "model": "ernie-x1"}
    patch_httpx(monkeypatch, payload, capture)

    provider = WenxinProvider("test-key", base_url="https://wenxin.mock")
    result = provider.call([{"role": "user", "content": "hi"}])

    assert result["text"] == "文心回答"
    assert capture["url"] == "https://wenxin.mock"
    assert capture["headers"]["Authorization"] == "Bearer test-key"
    assert capture["json"]["model"] == "ernie-lite-8k"


def test_xinghuo_provider_parses_choice(monkeypatch):
    capture = {}
    payload = {"choices": [{"message": {"content": "星火回答"}}], "usage": {"prompt_tokens": 10}}
    patch_httpx(monkeypatch, payload, capture)

    provider = XinghuoProvider("spark-key", base_url="https://spark.mock")
    result = provider.call([{"role": "user", "content": "hi"}], model="spark-4.0")

    assert result["text"] == "星火回答"
    assert capture["url"] == "https://spark.mock"
    assert capture["json"]["model"] == "spark-4.0"
    assert capture["headers"]["Authorization"] == "Bearer spark-key"


def test_moonshot_provider_returns_choice(monkeypatch):
    capture = {}
    payload = {"choices": [{"message": {"content": "kimi回答"}}], "model": "kimi-k2"}
    patch_httpx(monkeypatch, payload, capture)

    provider = MoonshotProvider("moon-key", base_url="https://moonshot.mock")
    result = provider.call([{"role": "user", "content": "hi"}])

    assert result["text"] == "kimi回答"
    assert result["model"] == "kimi-k2"
    assert capture["headers"]["Authorization"] == "Bearer moon-key"


class _DummyProvider(AIProvider):
    def __init__(self):
        self.captured_kwargs = None

    def call(self, messages, **kwargs):
        self.captured_kwargs = kwargs
        return {"text": "ok"}


def test_registry_merges_config_params():
    """注册表应当把模型配置里的 params 作为默认参数传给 provider"""
    original_providers = registry._providers.copy()
    original_params = registry._provider_params.copy()
    try:
        registry._providers.clear()
        registry._provider_params.clear()
        provider = _DummyProvider()
        registry.register_provider("deepseek", provider, {"model": "deepseek-ai/DeepSeek-V3", "temperature": 0.1})

        result = registry.call_with_fallback([{"role": "user", "content": "hi"}], preferred_provider="deepseek")

        assert result["text"] == "ok"
        assert provider.captured_kwargs["model"] == "deepseek-ai/DeepSeek-V3"
        assert provider.captured_kwargs["temperature"] == 0.1
    finally:
        registry._providers = original_providers
        registry._provider_params = original_params

