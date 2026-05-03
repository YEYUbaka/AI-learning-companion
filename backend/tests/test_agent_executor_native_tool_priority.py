import pytest

from services.agent_executor import AgentExecutor


@pytest.mark.asyncio
async def test_execute_react_prefers_native_tools_before_local_plan(monkeypatch):
    executor = AgentExecutor(db=None, user_id=1, session_id=1)

    native_result = {
        "success": True,
        "answer": "Today's weather in Wuhan is cloudy, high 28C.",
        "trace_id": "native-web-trace",
        "quality_status": "pass",
        "confidence": 0.9,
        "evidence": [],
        "fallback_used": False,
        "observations": [
            {
                "tool_name": "web_search",
                "tool_input": {"query": "today weather in Wuhan"},
                "quality_status": "verified",
                "confidence": 0.88,
                "fallback_used": False,
            }
        ],
    }

    monkeypatch.setattr(executor, "_record_step", lambda *args, **kwargs: None)
    monkeypatch.setattr("services.agent_executor.AgentRepository.update_session_status", lambda *args, **kwargs: True)

    async def fake_try_native_tool_run(goal, mode):
        assert mode == "react"
        return native_result

    monkeypatch.setattr(executor, "_try_native_tool_run", fake_try_native_tool_run)
    monkeypatch.setattr(executor.planner, "plan", lambda goal: (_ for _ in ()).throw(AssertionError("local planner should not run")))

    result = await executor.execute_react("today weather in Wuhan")

    assert result["success"] is True
    assert result["trace_id"] == "native-web-trace"
    assert result["iterations"] == 1
    assert result["answer"] == "Today's weather in Wuhan is cloudy, high 28C."


def test_should_try_native_tools_first_only_for_supported_queries(monkeypatch):
    executor = AgentExecutor(db=None, user_id=1, session_id=1)

    monkeypatch.setattr(
        executor,
        "_get_provider_capabilities",
        lambda: {
            "native_search_mode": "responses_builtin_tools",
            "native_tools": ["web_search"],
        },
    )

    assert executor._should_try_native_tools_first("today weather in Wuhan") is True
    assert executor._should_try_native_tools_first("recommend a Java interview course") is True
    assert executor._should_try_native_tools_first("explain Newton's second law") is False


def test_should_try_native_tools_first_uses_latest_user_message(monkeypatch):
    executor = AgentExecutor(db=None, user_id=1, session_id=1)

    monkeypatch.setattr(
        executor,
        "_get_provider_capabilities",
        lambda: {
            "native_search_mode": "responses_builtin_tools",
            "native_tools": ["web_search"],
        },
    )

    wrapped_followup = (
        "请结合当前会话的上文来回答当前问题。\n\n"
        "对话上下文：\n"
        "用户: 最近有哪些值得关注的 AI 模型\n"
        "助手: 我给你列几个方向。\n\n"
        "当前用户消息：\n详细步骤能给一下吗"
    )
    wrapped_search = (
        "请结合当前会话的上文来回答当前问题。\n\n"
        "对话上下文：\n"
        "用户: 《活着》这本书怎么样\n"
        "助手: 这是一本很经典的小说。\n\n"
        "当前用户消息：\n帮我搜索它的作者是谁"
    )

    assert executor._should_try_native_tools_first(wrapped_followup) is False
    assert executor._should_try_native_tools_first(wrapped_search) is True


@pytest.mark.asyncio
async def test_try_native_tool_run_uses_qwen_enable_search_payload(monkeypatch):
    executor = AgentExecutor(db=None, user_id=1, session_id=1)
    captured = {}

    monkeypatch.setattr(executor, "_should_try_native_tools_first", lambda goal: True)
    monkeypatch.setattr(executor, "_get_native_search_mode", lambda: "qwen_chat_enable_search")

    async def fake_call_ai_async(**kwargs):
        captured.update(kwargs)
        return {
            "trace_id": "qwen-search-trace",
            "text": "Hangzhou will be cloudy tomorrow.",
            "quality_status": "pass",
            "confidence": 0.87,
            "fallback_used": False,
            "metadata": {
                "provider_format": "chat_completions",
                "usage": {"prompt_tokens": 1800, "completion_tokens": 120},
            },
        }

    monkeypatch.setattr("services.agent_executor.AIService.call_ai_async", fake_call_ai_async)

    result = await executor._try_native_tool_run("Hangzhou weather tomorrow", "react")

    assert captured["extra_model_args"]["enable_search"] is True
    assert captured["extra_model_args"]["search_options"] == {
        "forced_search": True,
        "search_strategy": "turbo",
    }
    assert result["trace_id"] == "qwen-search-trace"
    assert result["observations"][0]["tool_name"] == "web_search"
    assert result["observations"][0]["tool_input"]["forced_search"] is True


@pytest.mark.asyncio
async def test_try_native_tool_run_prefers_semantic_route_query(monkeypatch):
    executor = AgentExecutor(db=None, user_id=1, session_id=1)
    captured = {}

    monkeypatch.setattr(executor, "_should_try_native_tools_first", lambda goal, route=None: True)
    monkeypatch.setattr(executor, "_get_native_search_mode", lambda: "qwen_chat_enable_search")

    async def fake_call_ai_async(**kwargs):
        captured.update(kwargs)
        return {
            "trace_id": "semantic-search-trace",
            "text": "Wuhan will be cloudy in the next 24 hours.",
            "quality_status": "pass",
            "confidence": 0.9,
            "fallback_used": False,
            "metadata": {"provider_format": "chat_completions", "usage": {}},
        }

    monkeypatch.setattr("services.agent_executor.AIService.call_ai_async", fake_call_ai_async)

    route = {
        "intent": "fresh_search",
        "needs_tool": True,
        "needs_fresh_info": True,
        "preferred_tool": "web_search",
        "rewritten_query": "Wuhan next 24 hours weather forecast",
        "is_followup": False,
        "confidence": 0.93,
    }
    result = await executor._try_native_tool_run("未来二十四小时武汉天气怎么样", "react", route)

    assert captured["user_prompt"] == "Wuhan next 24 hours weather forecast"
    assert result["observations"][0]["tool_input"]["query"] == "Wuhan next 24 hours weather forecast"


@pytest.mark.asyncio
async def test_try_native_tool_run_uses_responses_builtin_web_search(monkeypatch):
    executor = AgentExecutor(db=None, user_id=1, session_id=1)
    captured = {}

    monkeypatch.setattr(executor, "_should_try_native_tools_first", lambda goal: True)
    monkeypatch.setattr(executor, "_get_native_search_mode", lambda: "responses_builtin_tools")

    async def fake_call_ai_async(**kwargs):
        captured.update(kwargs)
        return {
            "trace_id": "responses-trace",
            "text": "According to the search result, Wuhan is cloudy today.",
            "quality_status": "pass",
            "confidence": 0.9,
            "fallback_used": False,
            "tool_calls": [
                {
                    "type": "web_search_call",
                    "input": {"query": "today weather in Wuhan"},
                    "summary": "Fetched the latest weather information.",
                }
            ],
        }

    monkeypatch.setattr("services.agent_executor.AIService.call_ai_async", fake_call_ai_async)

    result = await executor._try_native_tool_run("today weather in Wuhan", "react")

    assert captured["extra_model_args"] == {"tools": [{"type": "web_search"}]}
    assert result["observations"][0]["tool_name"] == "web_search"
