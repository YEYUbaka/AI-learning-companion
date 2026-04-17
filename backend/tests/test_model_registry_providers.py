"""
Model registry tests.
"""
from types import SimpleNamespace

from core.config import settings
from utils.model_registry import (
    AIProvider,
    ModelRegistry,
    OpenAICompatProvider,
    PROVIDER_TEMPLATES,
    registry,
)


class DummyProvider(AIProvider):
    def __init__(self):
        self.captured_kwargs = None

    def call(self, messages, **kwargs):
        self.captured_kwargs = kwargs
        return {"text": "ok"}


def test_build_provider_from_config_uses_default_max_tokens(monkeypatch):
    monkeypatch.setattr("utils.model_registry.decrypt_api_key", lambda value: value)
    config = SimpleNamespace(
        provider_name="DeepSeek",
        api_key="plain-token",
        base_url="https://api.deepseek.com/v1/chat/completions",
        params={"model": "deepseek-chat"},
    )

    provider = ModelRegistry().build_provider_from_config(config)

    assert isinstance(provider, OpenAICompatProvider)
    assert provider.base_url == "https://api.deepseek.com/v1"
    assert provider.model_name == "deepseek-chat"
    assert provider.max_tokens == settings.AI_DEFAULT_MAX_TOKENS


def test_build_provider_from_config_preserves_explicit_max_tokens(monkeypatch):
    monkeypatch.setattr("utils.model_registry.decrypt_api_key", lambda value: value)
    config = SimpleNamespace(
        provider_name="openrouter",
        api_key="plain-token",
        base_url="https://openrouter.ai/api/v1",
        params={
            "model": "openai/gpt-4.1-mini",
            "max_tokens": 8192,
            "timeout": 45,
            "extra_headers": {"HTTP-Referer": "https://example.com"},
        },
    )

    provider = ModelRegistry().build_provider_from_config(config)

    assert provider.max_tokens == 8192
    assert provider.timeout == 45
    assert provider.extra_headers["HTTP-Referer"] == "https://example.com"


def test_provider_templates_expose_default_token_budget_and_capabilities():
    deepseek_template = PROVIDER_TEMPLATES["deepseek"]
    openrouter_template = PROVIDER_TEMPLATES["openrouter"]

    assert deepseek_template["default_max_tokens"] == settings.AI_DEFAULT_MAX_TOKENS
    assert deepseek_template["capabilities"]["streaming"] is True
    assert deepseek_template["capabilities"]["tool_calling"] is True
    assert openrouter_template["capabilities"]["streaming"] is True
    assert openrouter_template["capabilities"]["long_output"] is True


def test_registry_call_with_fallback_merges_registered_default_params():
    original_providers = registry._providers.copy()
    original_params = registry._provider_params.copy()
    try:
        registry._providers.clear()
        registry._provider_params.clear()

        provider = DummyProvider()
        registry.register_provider(
            "deepseek",
            provider,
            {"model": "deepseek-chat", "max_tokens": settings.AI_DEFAULT_MAX_TOKENS},
        )

        result = registry.call_with_fallback(
            [{"role": "user", "content": "hello"}],
            preferred_provider="deepseek",
        )

        assert result["text"] == "ok"
        assert provider.captured_kwargs["model"] == "deepseek-chat"
        assert provider.captured_kwargs["max_tokens"] == settings.AI_DEFAULT_MAX_TOKENS
    finally:
        registry._providers = original_providers
        registry._provider_params = original_params
