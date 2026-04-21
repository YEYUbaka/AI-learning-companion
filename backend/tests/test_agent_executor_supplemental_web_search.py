import pytest

from services.agent_executor import AgentExecutor


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
