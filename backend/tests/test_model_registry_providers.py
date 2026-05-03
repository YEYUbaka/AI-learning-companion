"""
Model registry tests.
"""
import base64
from types import SimpleNamespace

import httpx
import pytest

from core.config import settings
from services.agent_executor import AgentExecutor
from services.ai_service import AIService
from utils.model_registry import (
    AIProvider,
    ModelRegistry,
    OpenAICompatProvider,
    PROVIDER_TEMPLATES,
    ResponsesProvider,
    _summarize_http_error,
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
    assert provider.max_tokens == PROVIDER_TEMPLATES["deepseek"]["default_max_tokens"]


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


def test_build_provider_from_config_marks_doubao_seed_2_lite_as_vision_capable(monkeypatch):
    monkeypatch.setattr("utils.model_registry.decrypt_api_key", lambda value: value)
    config = SimpleNamespace(
        provider_name="doubao",
        api_key="plain-token",
        base_url="https://ark.cn-beijing.volces.com/api/v3",
        params={"model_name": "doubao-seed-2-0-lite-260215"},
        enabled=True,
    )

    provider = ModelRegistry().build_provider_from_config(config)

    assert provider is not None
    assert provider.get_capabilities()["supports_vision"] is True


def test_build_provider_from_config_keeps_qwen_chat_native_search_for_chat_models(monkeypatch):
    monkeypatch.setattr("utils.model_registry.decrypt_api_key", lambda value: value)
    config = SimpleNamespace(
        provider_name="qwen",
        api_key="plain-token",
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        params={"model_name": "qwen-plus"},
        enabled=True,
    )

    provider = ModelRegistry().build_provider_from_config(config)

    assert isinstance(provider, OpenAICompatProvider)
    assert provider.get_capabilities()["supports_responses_api"] is False
    assert provider.get_capabilities()["native_search_mode"] == "qwen_chat_enable_search"
    assert provider.get_capabilities()["native_tools"] == []


def test_build_provider_from_config_uses_responses_provider_for_qwen_responses_models(monkeypatch):
    monkeypatch.setattr("utils.model_registry.decrypt_api_key", lambda value: value)
    config = SimpleNamespace(
        provider_name="qwen",
        api_key="plain-token",
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        params={"model_name": "qwen3.5-plus"},
        enabled=True,
    )

    provider = ModelRegistry().build_provider_from_config(config)

    assert isinstance(provider, ResponsesProvider)
    assert provider.get_capabilities()["supports_responses_api"] is True
    assert provider.get_capabilities()["native_search_mode"] == "responses_builtin_tools"
    assert provider.get_capabilities()["native_tools"] == ["web_search", "web_extractor", "code_interpreter"]


def test_build_provider_from_config_disables_builtin_native_search_for_doubao_chat_only(monkeypatch):
    monkeypatch.setattr("utils.model_registry.decrypt_api_key", lambda value: value)
    config = SimpleNamespace(
        provider_name="doubao",
        api_key="plain-token",
        base_url="https://ark.cn-beijing.volces.com/api/v3",
        params={
            "model_name": "doubao-seed-1-6-250615",
            "supports_responses_api": False,
        },
        enabled=True,
    )

    provider = ModelRegistry().build_provider_from_config(config)

    assert isinstance(provider, OpenAICompatProvider)
    assert provider.get_capabilities()["supports_responses_api"] is False
    assert provider.get_capabilities()["native_search_mode"] == "none"
    assert provider.get_capabilities()["native_tools"] == []


def test_get_provider_capabilities_prefers_live_db_config(monkeypatch):
    live_provider = SimpleNamespace(get_capabilities=lambda: {"supports_vision": True, "supports_responses_api": True})
    config = SimpleNamespace(enabled=True)

    monkeypatch.setattr("services.ai_service.ModelConfigRepository.get_by_provider", lambda db, provider: config)
    monkeypatch.setattr("services.ai_service.registry.build_provider_from_config", lambda model_config: live_provider)
    monkeypatch.setattr("services.ai_service.registry.get_provider_capabilities", lambda provider: {"supports_vision": False})

    capabilities = AIService.get_provider_capabilities("doubao", db=object())

    assert capabilities["supports_vision"] is True
    assert capabilities["supports_responses_api"] is True


def test_call_ai_refreshes_provider_from_live_db_before_registry_call(monkeypatch):
    captured = {}
    live_provider = SimpleNamespace(get_capabilities=lambda: {"supports_vision": True})
    config = SimpleNamespace(id=9, provider_name="doubao", enabled=True, params={"model_name": "doubao-seed-2-0-lite-260215"})

    monkeypatch.setattr("services.ai_service.PromptService.get_system_prompt", lambda db, name: "system")
    monkeypatch.setattr("services.ai_service.ModelConfigRepository.get_by_provider", lambda db, provider: config)
    monkeypatch.setattr("services.ai_service.registry.build_provider_from_config", lambda model_config: live_provider)

    def fake_register_provider(name, provider, params=None, aliases=None):
        captured["registered_name"] = name
        captured["registered_provider"] = provider
        captured["registered_params"] = params
        captured["registered_aliases"] = aliases

    monkeypatch.setattr("services.ai_service.registry.register_provider", fake_register_provider)
    monkeypatch.setattr(
        "services.ai_service.registry.call_with_fallback",
        lambda **kwargs: {"text": "ok", "provider": "doubao", "usage": {}, "model": "doubao-seed-2-0-lite-260215"},
    )
    monkeypatch.setattr("services.ai_service.registry.get_provider_capabilities", lambda provider: {"supports_vision": True})
    monkeypatch.setattr("services.ai_service.AIService._record_api_call", lambda db, provider, source, success: None)

    result = AIService.call_ai(db=object(), user_prompt="hello", provider="doubao")

    assert result["provider"] == "doubao"
    assert captured["registered_name"] == "doubao"
    assert captured["registered_provider"] is live_provider
    assert captured["registered_params"] == config.params
    assert "doubao" in captured["registered_aliases"]


def test_summarize_http_error_keeps_invalid_scheme_as_bad_request():
    response = httpx.Response(
        400,
        request=httpx.Request("POST", "https://ark.cn-beijing.volces.com/api/v3/responses"),
        json={"error": {"code": "InvalidParameter", "message": "invalid scheme for image_url"}},
    )

    message, category = _summarize_http_error("doubao", response)

    assert category == "bad_request"
    assert "invalid scheme" in message
    assert "API key" not in message


def test_agent_executor_converts_relative_upload_image_to_data_url(tmp_path, monkeypatch):
    image_bytes = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII="
    )
    uploads_dir = tmp_path / "uploads"
    uploads_dir.mkdir()
    image_path = uploads_dir / "sample.png"
    image_path.write_bytes(image_bytes)

    monkeypatch.setattr("services.agent_executor.FeatureModelConfigService.get_provider_for_feature", lambda db, feature: "doubao")
    monkeypatch.setattr("services.agent_executor.AgentRepository.get_session", lambda db, session_id: None)
    monkeypatch.setattr("services.agent_executor.Path.cwd", classmethod(lambda cls: tmp_path))

    executor = AgentExecutor(
        db=object(),
        user_id=1,
        session_id=1,
        context={
            "attachments": [
                {
                    "type": "image",
                    "file_type": "image",
                    "file_path": "uploads/sample.png",
                    "image_url": "/uploads/sample.png",
                    "mime_type": "image/png",
                }
            ]
        },
    )

    content_block = executor._build_image_content_block(executor.attachments[0])

    assert content_block is not None
    assert content_block["type"] == "input_image"
    assert content_block["image_url"].startswith("data:image/png;base64,")


def test_provider_templates_expose_default_token_budget_and_capabilities():
    deepseek_template = PROVIDER_TEMPLATES["deepseek"]
    openrouter_template = PROVIDER_TEMPLATES["openrouter"]

    assert deepseek_template["default_max_tokens"] == settings.AI_DEFAULT_MAX_TOKENS
    assert deepseek_template["capabilities"]["streaming"] is True
    assert deepseek_template["capabilities"]["tool_calling"] is True
    assert openrouter_template["capabilities"]["streaming"] is True
    assert openrouter_template["capabilities"]["long_output"] is True


def test_qwen_chat_payload_includes_enable_search_fields():
    provider = OpenAICompatProvider(
        provider_name="qwen",
        api_key="plain-token",
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        model_name="qwen-plus",
        temperature=0.7,
        max_tokens=2048,
        top_p=1.0,
        capabilities={"tool_calling": True, "native_search_mode": "qwen_chat_enable_search"},
    )

    payload = provider._build_payload(  # pylint: disable=protected-access
        messages=[{"role": "user", "content": "杭州明天天气如何"}],
        enable_search=True,
        search_options={"forced_search": True, "search_strategy": "turbo"},
    )

    assert payload["enable_search"] is True
    assert payload["search_options"] == {"forced_search": True, "search_strategy": "turbo"}


def test_openai_compat_chat_payload_rejects_builtin_web_tools():
    provider = OpenAICompatProvider(
        provider_name="qwen",
        api_key="plain-token",
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        model_name="qwen-plus",
        temperature=0.7,
        max_tokens=2048,
        top_p=1.0,
        capabilities={"tool_calling": True},
    )

    with pytest.raises(ValueError, match="chat/completions only supports function tools"):
        provider._build_payload(  # pylint: disable=protected-access
            messages=[{"role": "user", "content": "杭州天气"}],
            tools=[{"type": "web_search"}],
        )


def test_preferred_admin_provider_templates_match_expected_base_urls():
    assert PROVIDER_TEMPLATES["siliconflow"]["display_name"] == "SiliconFlow"
    assert PROVIDER_TEMPLATES["siliconflow"]["default_base_url"] == "https://api.siliconflow.cn/v1"
    assert PROVIDER_TEMPLATES["zhipu"]["display_name"] == "Zhipu"
    assert PROVIDER_TEMPLATES["zhipu"]["default_base_url"] == "https://open.bigmodel.cn/api/paas/v4"
    assert PROVIDER_TEMPLATES["moonshot"]["display_name"] == "Moonshot"
    assert PROVIDER_TEMPLATES["moonshot"]["default_base_url"] == "https://api.moonshot.cn/v1"
    assert PROVIDER_TEMPLATES["openrouter"]["display_name"] == "OpenRouter"
    assert PROVIDER_TEMPLATES["openrouter"]["default_base_url"] == "https://openrouter.ai/api/v1"


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
