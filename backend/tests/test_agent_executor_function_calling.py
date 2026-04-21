import pytest

from services.agent_executor import AgentExecutor


@pytest.mark.asyncio
async def test_execute_function_calling_falls_back_to_structured_executor(monkeypatch):
    executor = AgentExecutor(db=None, user_id=1, session_id=1)

    def fake_call_ai_with_tools(**kwargs):
        raise Exception("native tools unavailable")

    async def fake_execute_react(goal):
        return {
            "success": True,
            "answer": f"fallback:{goal}",
            "trace_id": "fallback-trace",
            "quality_status": "pass",
            "confidence": 0.8,
            "evidence": [],
            "fallback_used": True,
        }

    monkeypatch.setattr("services.agent_executor.AIService.call_ai_with_tools", fake_call_ai_with_tools)
    monkeypatch.setattr(executor, "execute_react", fake_execute_react)

    result = await executor.execute_function_calling("解释牛顿第二定律")

    assert result["success"] is True
    assert result["answer"] == "fallback:解释牛顿第二定律"
    assert result["fallback_used"] is True


@pytest.mark.asyncio
async def test_execute_function_calling_uses_native_tool_calls(monkeypatch):
    executor = AgentExecutor(db=None, user_id=1, session_id=1)

    def fake_call_ai_with_tools(**kwargs):
        return {
            "trace_id": "native-trace",
            "tool_calls": [
                {
                    "function": {
                        "name": "search_knowledge",
                        "arguments": "{\"query\": \"牛顿第二定律\", \"limit\": 2}",
                    }
                }
            ],
            "quality_status": "pass",
            "confidence": 0.91,
            "fallback_used": False,
            "evidence": [],
        }

    async def fake_execute_tool_step(trace_id, step_number, tool_name, tool_input):
        assert trace_id == "native-trace"
        assert tool_name == "search_knowledge"
        assert tool_input["query"] == "牛顿第二定律"
        return {
            "tool_name": tool_name,
            "success": True,
            "quality_status": "pass",
            "confidence": 0.88,
            "evidence": [{"summary": "命中知识库证据"}],
            "fallback_used": False,
            "text": "命中知识库证据",
        }

    monkeypatch.setattr("services.agent_executor.AIService.call_ai_with_tools", fake_call_ai_with_tools)
    monkeypatch.setattr(executor, "_record_step", lambda *args, **kwargs: None)
    monkeypatch.setattr("services.agent_executor.AgentRepository.update_session_status", lambda *args, **kwargs: True)
    monkeypatch.setattr(executor, "_execute_tool_step", fake_execute_tool_step)
    async def fake_build_final_answer_async(goal, plan, observations, review):
        return "最终答案"

    monkeypatch.setattr(executor, "_build_final_answer_async", fake_build_final_answer_async)

    result = await executor.execute_function_calling("解释牛顿第二定律")

    assert result["success"] is True
    assert result["trace_id"] == "native-trace"
    assert result["iterations"] == 1
    assert result["answer"] == "最终答案"
