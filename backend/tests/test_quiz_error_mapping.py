import httpx
import pytest
from fastapi import HTTPException

from core.exceptions import UpstreamServiceError
from routers.quiz import GenerateQuizRequest, SubmitQuizRequest, quiz_generate, quiz_submit
from utils.model_registry import AIProvider, registry


class AuthFailingProvider(AIProvider):
    def call(self, messages, **kwargs):
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
        assert "上游 HTTP 401" in str(exc_info.value)
    finally:
        registry._providers = original_providers
        registry._provider_params = original_params


@pytest.mark.asyncio
async def test_quiz_submit_preserves_upstream_service_status(monkeypatch):
    async_error = UpstreamServiceError(
        "AI 上游认证失败（上游 HTTP 401），请检查管理后台 API Key 配置",
        http_status=502,
        upstream_status=401,
    )

    def fake_evaluate_quiz(**kwargs):
        raise async_error

    monkeypatch.setattr("routers.quiz.evaluate_quiz", fake_evaluate_quiz)

    request = SubmitQuizRequest(
        user_id=1,
        topic="牛顿第二定律",
        questions=[{"question": "F=ma 中 F 表示什么", "answer": "力", "type": "fill"}],
        answers=["力"],
    )
    db = DummyDB()

    with pytest.raises(HTTPException) as exc_info:
        await quiz_submit(request, db=db)

    assert exc_info.value.status_code == 502
    assert "上游 HTTP 401" in str(exc_info.value.detail)
    assert db.rollback_called is True


@pytest.mark.asyncio
async def test_quiz_generate_preserves_upstream_service_status(monkeypatch):
    async_error = UpstreamServiceError(
        "AI 上游限流（上游 HTTP 429），请稍后重试",
        http_status=503,
        upstream_status=429,
    )

    def fake_generate_quiz(**kwargs):
        raise async_error

    monkeypatch.setattr("routers.quiz.generate_quiz", fake_generate_quiz)

    request = GenerateQuizRequest(topic="牛顿第二定律", num_questions=3)

    with pytest.raises(HTTPException) as exc_info:
        await quiz_generate(request, db=object())

    assert exc_info.value.status_code == 503
    assert "上游 HTTP 429" in str(exc_info.value.detail)
