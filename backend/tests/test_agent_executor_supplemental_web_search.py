import pytest

from services.agent_executor import AgentExecutor, AgentPlanner


TECH_LEARNING_QUERY = "帮我推荐一个能够达到面试程度的Java学习路径"


@pytest.mark.asyncio
async def test_execute_react_adds_web_search_after_empty_knowledge_result(monkeypatch):
    executor = AgentExecutor(db=None, user_id=1, session_id=1)
    calls = []

    monkeypatch.setattr(executor, "_record_step", lambda *args, **kwargs: None)
    monkeypatch.setattr("services.agent_executor.AgentRepository.update_session_status", lambda *args, **kwargs: True)

    async def fake_execute_tool_step(trace_id, step_number, tool_name, tool_input):
        calls.append(tool_name)
        if tool_name == "search_knowledge":
            return {
                "tool_name": "search_knowledge",
                "success": True,
                "quality_status": "pass",
                "confidence": 0.35,
                "evidence": [],
                "results": [],
                "count": 0,
                "text": "知识库暂时无匹配证据。",
                "fallback_used": True,
            }
        if tool_name == "web_search":
            return {
                "tool_name": "web_search",
                "success": True,
                "quality_status": "pass",
                "confidence": 0.74,
                "evidence": [
                    {
                        "type": "web_result",
                        "title": "Java 学习路线图",
                        "summary": "Java 学习路线图",
                        "excerpt": "整理 Java 面试学习路线",
                        "url": "https://example.com/java-roadmap",
                    }
                ],
                "results": [
                    {
                        "title": "Java 学习路线图",
                        "snippet": "整理 Java 面试学习路线",
                        "url": "https://example.com/java-roadmap",
                    }
                ],
                "count": 1,
                "fallback_used": False,
            }
        if tool_name == "generate_study_plan":
            return {
                "tool_name": "generate_study_plan",
                "success": True,
                "quality_status": "verified",
                "confidence": 0.78,
                "evidence": [],
                "plan": {"goal": TECH_LEARNING_QUERY, "duration_days": 30, "daily_plan": []},
                "fallback_used": False,
            }
        raise AssertionError(f"unexpected tool: {tool_name}")

    async def fake_build_final_answer_async(goal, plan, observations, review):
        return "final-answer"

    monkeypatch.setattr(executor, "_execute_tool_step", fake_execute_tool_step)
    monkeypatch.setattr(executor, "_build_final_answer_async", fake_build_final_answer_async)
    monkeypatch.setattr(
        executor.reviewer,
        "review",
        lambda plan, observations: {
            "quality_status": "pass",
            "confidence": 0.8,
            "evidence": [item for obs in observations for item in obs.get("evidence", [])],
            "fallback_used": False,
        },
    )

    result = await executor.execute_react(TECH_LEARNING_QUERY)

    assert result["success"] is True
    assert calls == ["search_knowledge", "web_search", "generate_study_plan"]
    assert result["iterations"] == 3
    assert result["evidence"][0]["url"] == "https://example.com/java-roadmap"


def test_should_not_add_supplemental_web_search_for_plain_learning_path():
    executor = AgentExecutor(db=None, user_id=1, session_id=1)
    observation = {
        "tool_name": "search_knowledge",
        "success": True,
        "quality_status": "pass",
        "confidence": 0.35,
        "evidence": [],
        "results": [],
        "count": 0,
        "text": "知识库暂时无匹配证据。",
        "fallback_used": True,
    }

    should_search = executor._should_add_supplemental_web_search(
        "Java学习路线怎么学",
        observation,
        [observation],
    )

    assert should_search is False


def test_planner_builds_context_aware_search_query():
    planner = AgentPlanner(tool_registry=None)
    goal = (
        "请结合当前会话的上文来回答当前问题。\n\n"
        "对话上下文：\n"
        "用户: 《活着》这本书怎么样\n"
        "助手: 这是一本很经典的小说。\n\n"
        "当前用户消息：\n帮我搜索它的作者是谁"
    )

    plan = planner.plan(goal)

    assert plan["tool_steps"][0]["tool_name"] == "web_search"
    assert plan["tool_steps"][0]["tool_input"]["query"] == "《活着》这本书怎么样 它的作者是谁"
    assert "对话上下文" not in plan["tool_steps"][0]["tool_input"]["query"]
    assert "当前用户消息" not in plan["tool_steps"][0]["tool_input"]["query"]
