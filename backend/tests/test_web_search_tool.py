from types import SimpleNamespace

import pytest

from utils.agent_tools import WebSearchTool


PYTHON_LEARNING_PATH_QUERY = "帮我推荐一个能够达到面试程度的Python学习路径"


@pytest.mark.asyncio
async def test_web_search_filters_noise_and_uses_query_fallback(monkeypatch):
    tool = WebSearchTool()
    query_candidates = tool._build_query_candidates(PYTHON_LEARNING_PATH_QUERY)
    assert query_candidates[0] == "Python 面试 学习路径 路线图"
    calls = []

    class FakeDDGS:
        def text(self, query, max_results=5):
            calls.append(query)
            if query == query_candidates[0]:
                return [
                    {
                        "title": "Python企业信息查询 - 爱企查",
                        "body": "爱企查为您提供Python相关工商查询信息。",
                        "href": "https://aiqicha.baidu.com/company_detail_1",
                    }
                ]
            if query == query_candidates[1]:
                return [
                    {
                        "title": "Python Developer Roadmap",
                        "body": "A step-by-step roadmap for Python interview preparation.",
                        "href": "https://roadmap.sh/python",
                    }
                ]
            return []

    monkeypatch.setitem(__import__("sys").modules, "ddgs", SimpleNamespace(DDGS=FakeDDGS))

    result = await tool.execute(db=None, user_id=1, query=PYTHON_LEARNING_PATH_QUERY, max_results=5)

    assert calls == query_candidates[:2]
    assert result["success"] is True
    assert result["fallback_used"] is True
    assert result["query_used"] == query_candidates[1]
    assert result["query_candidates"] == query_candidates
    assert result["count"] == 1
    assert result["results"][0]["url"] == "https://roadmap.sh/python"
    assert "aiqicha" not in result["results"][0]["url"]
    assert result["evidence"][0]["url"] == "https://roadmap.sh/python"


@pytest.mark.asyncio
async def test_web_search_skips_low_signal_results_for_learning_queries(monkeypatch):
    tool = WebSearchTool()
    query_candidates = tool._build_query_candidates(PYTHON_LEARNING_PATH_QUERY)
    calls = []

    class FakeDDGS:
        def text(self, query, max_results=5):
            calls.append(query)
            if query == query_candidates[0]:
                return [
                    {
                        "title": "Welcome to Python.org",
                        "body": "The official home of the Python Programming Language.",
                        "href": "https://www.python.org/",
                    }
                ]
            if query == query_candidates[1]:
                return [
                    {
                        "title": "Python Developer Roadmap",
                        "body": "A step-by-step roadmap for Python interview preparation.",
                        "href": "https://roadmap.sh/python",
                    }
                ]
            return []

    monkeypatch.setitem(__import__("sys").modules, "ddgs", SimpleNamespace(DDGS=FakeDDGS))

    result = await tool.execute(db=None, user_id=1, query=PYTHON_LEARNING_PATH_QUERY, max_results=5)

    assert calls == query_candidates[:2]
    assert result["query_used"] == query_candidates[1]
    assert result["results"][0]["url"] == "https://roadmap.sh/python"
