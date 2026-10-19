import httpx
import pytest
from fastapi import HTTPException

from core.exceptions import UpstreamServiceError
from routers.quiz import GenerateQuizRequest, SubmitQuizRequest, quiz_generate, quiz_submit
from utils.model_registry import AIProvider, registry


class AuthFailingProvider(AIProvider):
    def __init__(self):
        super().__init__(
            provider_name="deepseek",
            api_key="invalid",
            base_url="https://api.example.com/v1",
            model_name="test-model",
            temperature=0.0,
            max_tokens=4096,
            top_p=1.0,
        )

    def call(self, messages=None, input_items=None, **kwargs):
        request = httpx.Request("POST", "https://api.example.com/v1/chat/completions")
        response = httpx.Response(
            401,
            request=request,
            json={"error": {"message": "Api key is invalid"}},
        )
        raise httpx.HTTPStatusError(
            "401 Unauthorized",
            request=request,
            response=response,
        )


class DummyDB:
    def __init__(self):
        self.rollback_called = False

    def rollback(self):
        self.rollback_called = True


def test_registry_call_with_fallback_raises_gateway_error_for_upstream_auth_failure():
    original_providers = registry._providers.copy()
    original_params = registry._provider_params.copy()

    try:
        registry._providers.clear()
        registry._provider_params.clear()
        registry.register_provider("deepseek", AuthFailingProvider())

        with pytest.raises(UpstreamServiceError) as exc_info:
            registry.call_with_fallback(
                [{"role": "user", "content": "hello"}],
                preferred_provider="deepseek",
                allow_fallback=False,
            )

        assert exc_info.value.http_status == 502
        assert exc_info.value.upstream_status == 401
        assert "HTTP 401" in str(exc_info.value)
    finally:
        registry._providers = original_providers
        registry._provider_params = original_params


@pytest.mark.asyncio
async def test_quiz_submit_preserves_upstream_service_status(monkeypatch):
    async_error = UpstreamServiceError(
        "AI upstream authentication failed (HTTP 401)",
        http_status=502,
        upstream_status=401,
    )

    def fake_evaluate_quiz(**kwargs):
        raise async_error

    monkeypatch.setattr("routers.quiz.evaluate_quiz", fake_evaluate_quiz)

    request = SubmitQuizRequest(
        user_id=1,
        topic="Newton second law",
        questions=[{"question": "What does F represent in F=ma?", "answer": "force", "type": "fill"}],
        answers=["force"],
    )
    db = DummyDB()

    with pytest.raises(HTTPException) as exc_info:
        await quiz_submit(request, db=db)

    assert exc_info.value.status_code == 502
    assert "HTTP 401" in str(exc_info.value.detail)
    assert db.rollback_called is True


@pytest.mark.asyncio
async def test_quiz_generate_preserves_upstream_service_status(monkeypatch):
    async_error = UpstreamServiceError(
        "AI upstream rate limited (HTTP 429)",
        http_status=503,
        upstream_status=429,
    )

    def fake_generate_quiz(**kwargs):
        raise async_error

    monkeypatch.setattr("routers.quiz.FeatureModelConfigService.get_provider_for_feature", lambda db, feature_key: None)
    monkeypatch.setattr("routers.quiz.generate_quiz", fake_generate_quiz)

    request = GenerateQuizRequest(topic="Newton second law", num_questions=3)

    with pytest.raises(HTTPException) as exc_info:
        await quiz_generate(request, db=object())

    assert exc_info.value.status_code == 503
    assert "HTTP 429" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_quiz_generate_uses_feature_model_provider_when_request_provider_missing(monkeypatch):
    captured = {}

    def fake_get_provider_for_feature(db, feature_key):
        captured["feature_key"] = feature_key
        return "siliconflow"

    def fake_generate_quiz(**kwargs):
        captured["provider"] = kwargs.get("provider")
        return [{"question": "1+1=?", "answer": "2", "type": "fill"}]

    monkeypatch.setattr("routers.quiz.FeatureModelConfigService.get_provider_for_feature", fake_get_provider_for_feature)
    monkeypatch.setattr("routers.quiz.generate_quiz", fake_generate_quiz)

    request = GenerateQuizRequest(topic="basic math", num_questions=1)
    response = await quiz_generate(request, db=object())

    assert response["success"] is True
    assert captured["feature_key"] == "quiz"
    assert captured["provider"] == "siliconflow"
