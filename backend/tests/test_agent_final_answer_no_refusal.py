import pytest

from services.agent_executor import AgentExecutor


@pytest.mark.asyncio
async def test_final_answer_repairs_empty_knowledge_refusal(monkeypatch):
    executor = AgentExecutor(db=None, user_id=1, session_id=1)
    calls = []

    async def fake_call_ai_async(**kwargs):
        calls.append(kwargs["user_prompt"])
        if len(calls) == 1:
            return {
                "text": (
                    "很抱歉，当前暂未检索到关于二次函数图像性质（包含开口方向、"
                    "对称轴、顶点坐标）的对应知识点内容，无法为你提供准确的讲解。"
                )
            }
        return {
            "text": (
                "## 正式回答\n"
                "二次函数 y=ax^2+bx+c 的图像是一条抛物线。a>0 时开口向上，"
                "a<0 时开口向下；对称轴是 x=-b/(2a)；顶点坐标是 "
                "(-b/(2a), (4ac-b^2)/(4a))。"
            )
        }

    monkeypatch.setattr("services.agent_executor.AIService.call_ai_async", fake_call_ai_async)

    answer = await executor._build_final_answer_async(
        goal="请帮我讲解二次函数图像的性质，包括开口方向、对称轴和顶点坐标",
        plan={"rationale": "先查知识库，再生成讲解"},
        observations=[
            {
                "tool_name": "search_knowledge",
                "success": True,
                "results": [],
                "count": 0,
                "fallback_used": True,
                "text": "知识库暂无匹配证据。",
            }
        ],
        review={"quality_status": "pass", "confidence": 0.4, "evidence": []},
    )

    assert len(calls) == 2
    assert "暂未检索到" not in answer
    assert "无法为你提供准确" not in answer
    assert "对称轴" in answer
    assert "-b/(2a)" in answer
