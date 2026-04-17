"""
Async AI service wrapper tests.
"""
import pytest

from services.ai_service import AIService


class DummySession:
    def __init__(self):
        self.closed = False

    def close(self):
        self.closed = True


@pytest.mark.asyncio
async def test_call_ai_async_uses_thread_wrapper(monkeypatch):
    calls = {}

    async def fake_to_thread(func, *args, **kwargs):
        calls["used_to_thread"] = True
        return func(*args, **kwargs)

    def fake_session_local():
        session = DummySession()
        calls["session"] = session
        return session

    def fake_call_ai(**kwargs):
        calls["kwargs"] = kwargs
        return {"text": "ok"}

    monkeypatch.setattr("services.ai_service.asyncio.to_thread", fake_to_thread)
    monkeypatch.setattr("services.ai_service.SessionLocal", fake_session_local)
    monkeypatch.setattr(AIService, "call_ai", staticmethod(fake_call_ai))

    result = await AIService.call_ai_async(
        user_prompt="hello",
        system_prompt_name="system_prompt",
        max_tokens=16384,
    )

    assert calls["used_to_thread"] is True
    assert calls["kwargs"]["user_prompt"] == "hello"
    assert calls["kwargs"]["db"] is calls["session"]
    assert calls["session"].closed is True
    assert result == {"text": "ok"}


@pytest.mark.asyncio
async def test_call_ai_with_tools_async_uses_thread_wrapper(monkeypatch):
    calls = {}

    async def fake_to_thread(func, *args, **kwargs):
        calls["used_to_thread"] = True
        return func(*args, **kwargs)

    def fake_session_local():
        session = DummySession()
        calls["session"] = session
        return session

    def fake_call_ai_with_tools(**kwargs):
        calls["kwargs"] = kwargs
        return {"tool_calls": []}

    monkeypatch.setattr("services.ai_service.asyncio.to_thread", fake_to_thread)
    monkeypatch.setattr("services.ai_service.SessionLocal", fake_session_local)
    monkeypatch.setattr(
        AIService,
        "call_ai_with_tools",
        staticmethod(fake_call_ai_with_tools),
    )

    result = await AIService.call_ai_with_tools_async(
        user_prompt="hello",
        tools=[{"type": "function"}],
        max_tokens=16384,
    )

    assert calls["used_to_thread"] is True
    assert calls["kwargs"]["tools"] == [{"type": "function"}]
    assert calls["kwargs"]["db"] is calls["session"]
    assert calls["session"].closed is True
    assert result == {"tool_calls": []}
