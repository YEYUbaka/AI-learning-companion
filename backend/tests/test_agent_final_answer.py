from types import SimpleNamespace

import pytest

from services.agent_executor import AgentExecutor


@pytest.mark.asyncio
async def test_build_final_answer_async_fallback_is_user_facing(monkeypatch):
    executor = AgentExecutor(db=None, user_id=1, session_id=1)

    async def fake_call_ai_async(**kwargs):
        raise Exception("provider unavailable")

    monkeypatch.setattr("services.agent_executor.AIService.call_ai_async", fake_call_ai_async)

    answer = await executor._build_final_answer_async(
        goal="搜索一下今天的最新 AI 新闻，给我一个简短的总结",
        plan={"rationale": "先联网检索，再生成结论"},
        observations=[],
        review={
            "quality_status": "pass",
            "confidence": 0.74,
            "evidence": [
                {"summary": "DeepSeek 与 ChatGPT 在中文语境能力上的比较仍是热点"},
                {"summary": "AI 新闻聚焦中美在 AI 领域的动态与竞争"},
            ],
            "fallback_used": False,
        },
    )

    assert executor.final_answer_fallback_used is True
    assert "## 正式回答" in answer
    assert "任务目标" not in answer
    assert "quality_status" not in answer
    assert "置信度" not in answer

