import pytest

from services.agent_executor import AgentExecutor


def test_build_plan_from_semantic_route_maps_fresh_search():
    executor = AgentExecutor(db=None, user_id=1, session_id=1)

    plan = executor._build_plan_from_semantic_route(
        "未来二十四小时武汉天气怎么样",
        {
            "intent": "fresh_search",
            "needs_tool": True,
            "needs_fresh_info": True,
            "preferred_tool": "web_search",
            "rewritten_query": "武汉 未来24小时天气预报",
            "is_followup": False,
            "confidence": 0.92,
        },
    )

    assert plan is not None
    assert plan["tool_steps"][0]["tool_name"] == "web_search"
    assert plan["tool_steps"][0]["tool_input"]["query"] == "武汉 未来24小时天气预报"


@pytest.mark.asyncio
async def test_run_semantic_router_returns_none_on_ai_failure(monkeypatch):
    executor = AgentExecutor(db=None, user_id=1, session_id=1)

    async def fail_call_ai_async(**kwargs):
        raise RuntimeError("provider timeout")

    monkeypatch.setattr("services.agent_executor.AIService.call_ai_async", fail_call_ai_async)

    route = await executor._run_semantic_router("帮我推荐一个适合入门 Python 的视频课程")

    assert route is None


@pytest.mark.asyncio
async def test_execute_react_uses_semantic_direct_answer_without_planner(monkeypatch):
    executor = AgentExecutor(db=None, user_id=1, session_id=1)

    monkeypatch.setattr(executor, "_record_step", lambda *args, **kwargs: None)
    monkeypatch.setattr("services.agent_executor.AgentRepository.update_session_status", lambda *args, **kwargs: True)
    monkeypatch.setattr(executor, "_has_prior_assistant_answer", lambda: False)

    async def fake_run_semantic_router(goal):
        return {
            "intent": "direct_answer",
            "needs_tool": False,
            "needs_fresh_info": False,
            "preferred_tool": "none",
            "rewritten_query": "牛顿第二定律是什么",
            "is_followup": False,
            "confidence": 0.86,
        }

    async def fake_semantic_direct_answer(goal, mode):
        assert mode == "react"
        return {
            "success": True,
            "answer": "牛顿第二定律说明物体所受合力等于质量乘以加速度。",
            "quality_status": "pass",
            "confidence": 0.89,
            "evidence": [],
            "fallback_used": False,
        }

    async def fail_native(*args, **kwargs):
        raise AssertionError("native search should not run for semantic direct answer")

    monkeypatch.setattr(executor, "_run_semantic_router", fake_run_semantic_router)
    monkeypatch.setattr(executor, "_execute_semantic_direct_answer", fake_semantic_direct_answer)
    monkeypatch.setattr(executor, "_try_native_tool_run", fail_native)
    monkeypatch.setattr(
        executor.planner,
        "plan",
        lambda goal: (_ for _ in ()).throw(AssertionError("planner should not run for semantic direct answer")),
    )

    result = await executor.execute_react("牛顿第二定律是什么")

    assert result["success"] is True
    assert result["answer"].startswith("牛顿第二定律")
    assert result["iterations"] == 1
