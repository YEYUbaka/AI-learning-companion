from types import SimpleNamespace

from utils.model_registry import ModelRegistry


def test_load_from_db_resolves_provider_name_and_id_aliases(monkeypatch):
    registry = ModelRegistry()
    original_providers = registry._providers.copy()
    original_params = registry._provider_params.copy()
    original_aliases = registry._provider_aliases.copy()

    config = SimpleNamespace(
        id=6,
        provider_name="zhipu",
        api_key="plain-token",
        base_url="https://open.bigmodel.cn/api/paas/v4/chat/completions",
        params={"model": "glm-4-flash"},
    )

    monkeypatch.setattr("utils.model_registry.decrypt_api_key", lambda value: value)
    monkeypatch.setattr(
        "utils.model_registry.ModelConfigRepository.get_all_enabled",
        lambda db: [config],
    )

    try:
        registry.load_from_db(db=object())

        provider_by_name = registry.get_provider("zhipu")
        provider_by_id = registry.get_provider("6")

        assert provider_by_name is not None
        assert provider_by_id is provider_by_name
    finally:
        registry._providers = original_providers
        registry._provider_params = original_params
        registry._provider_aliases = original_aliases
