import pytest

from services.agent_executor import AgentExecutor


def test_should_answer_from_context_directly_for_followup(monkeypatch):
    executor = AgentExecutor(db=None, user_id=1, session_id=1)

    monkeypatch.setattr(executor, "_has_prior_assistant_answer", lambda: True)

    assert executor._should_answer_from_context_directly("详细步骤能给一下吗") is True
    assert executor._should_answer_from_context_directly("今天武汉天气怎么样") is False
    assert executor._should_answer_from_context_directly("再查一下今天武汉天气") is False


@pytest.mark.asyncio
async def test_execute_react_answers_contextual_followup_without_search(monkeypatch):
    executor = AgentExecutor(db=None, user_id=1, session_id=1)

    monkeypatch.setattr(executor, "_record_step", lambda *args, **kwargs: None)
    monkeypatch.setattr(executor, "_has_prior_assistant_answer", lambda: True)
    monkeypatch.setattr(
        "services.agent_executor.AgentRepository.update_session_status",
        lambda *args, **kwargs: True,
    )

    async def fake_contextual_followup(goal, mode):
        assert mode == "react"
        assert "详细步骤能给一下吗" in goal
        return {
            "success": True,
            "answer": "下面按步骤详细展开。",
            "quality_status": "pass",
            "confidence": 0.91,
            "evidence": [],
            "fallback_used": False,
        }

    async def fail_native(*args, **kwargs):
        raise AssertionError("native search should not run for contextual follow-up")

    async def fail_semantic_router(goal):
        raise AssertionError("semantic router should not run for contextual follow-up")

    monkeypatch.setattr(executor, "_execute_contextual_followup_direct", fake_contextual_followup)
    monkeypatch.setattr(executor, "_try_native_tool_run", fail_native)
    monkeypatch.setattr(executor, "_run_semantic_router", fail_semantic_router)
    monkeypatch.setattr(
        executor.planner,
        "plan",
        lambda goal: (_ for _ in ()).throw(AssertionError("planner should not run for contextual follow-up")),
    )

    result = await executor.execute_react("详细步骤能给一下吗")

    assert result["success"] is True
    assert result["iterations"] == 1
    assert result["answer"] == "下面按步骤详细展开。"
