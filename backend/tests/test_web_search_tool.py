from types import SimpleNamespace

import httpx
import pytest

from utils.agent_tools import WebSearchTool

WEATHER_QUERY = "武汉今天天气怎么样"


PYTHON_LEARNING_PATH_QUERY = "帮我推荐一个能够达到面试程度的Python学习路径"


@pytest.mark.asyncio
async def test_web_search_filters_noise_and_uses_query_fallback(monkeypatch):
    tool = WebSearchTool()
    query_candidates = tool._build_query_candidates(PYTHON_LEARNING_PATH_QUERY)
    assert query_candidates[0] == "Python 面试 学习路径 路线图"
    calls = []

    class FakeDDGS:
        def text(self, query, max_results=5, **kwargs):
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
        def text(self, query, max_results=5, **kwargs):
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


def test_web_search_builds_weather_candidates():
    tool = WebSearchTool()

    assert tool._build_query_candidates(WEATHER_QUERY) == [
        "武汉今天天气怎么样",
        "武汉 今天天气预报",
        "武汉 天气预报",
        "武汉 weather forecast",
    ]


@pytest.mark.asyncio
async def test_web_search_weather_query_prefers_weather_results_and_cn_region(monkeypatch):
    tool = WebSearchTool()
    query_candidates = tool._build_query_candidates(WEATHER_QUERY)
    calls = []

    class FakeDDGS:
        def text(self, query, **kwargs):
            calls.append((query, kwargs.get("region")))
            if query == query_candidates[0]:
                return [
                    {
                        "title": "如何评价全新一代揽胜？ - 知乎",
                        "body": "大家如何评价新一代揽胜。",
                        "href": "https://www.zhihu.com/question/529451858",
                    }
                ]
            if query == query_candidates[1]:
                return [
                    {
                        "title": "武汉天气预报,武汉7天天气预报,武汉15天天气预报,武汉天气查询",
                        "body": "武汉今天气温、降水、风力预报。",
                        "href": "https://www.weather.com.cn/weather/101200101.shtml",
                    }
                ]
            return []

    monkeypatch.setitem(__import__("sys").modules, "ddgs", SimpleNamespace(DDGS=FakeDDGS))

    result = await tool.execute(db=None, user_id=1, query=WEATHER_QUERY, max_results=5)

    assert calls == [
        (query_candidates[0], "cn-zh"),
        (query_candidates[1], "cn-zh"),
    ]
    assert result["success"] is True
    assert result["query_used"] == query_candidates[1]
    assert result["results"][0]["url"] == "https://www.weather.com.cn/weather/101200101.shtml"


@pytest.mark.asyncio
async def test_web_search_weather_query_prefers_qwen_official_search_before_ddgs(monkeypatch):
    tool = WebSearchTool()
    weather_result = {
        "success": True,
        "query": WEATHER_QUERY,
        "query_used": WEATHER_QUERY,
        "query_candidates": tool._build_query_candidates(WEATHER_QUERY),
        "results": [
            {
                "title": "武汉天气",
                "snippet": "今天夜里多云；明天晴到多云。",
                "url": "https://www.weather.com.cn/weather/101200101.shtml",
            }
        ],
        "count": 1,
        "text": "今天夜里多云；明天晴到多云。",
        "provider_search": "qwen_aliyun_weather_search_api",
    }

    monkeypatch.setattr(
        tool,
        "_search_weather_with_official_provider_safe",
        lambda db, raw_query, max_results: (weather_result, None),
    )

    class FailDDGS:
        def text(self, query, **kwargs):
            raise AssertionError("DDGS should not run when official provider search succeeds")

    monkeypatch.setitem(__import__("sys").modules, "ddgs", SimpleNamespace(DDGS=FailDDGS))

    result = await tool.execute(db=object(), user_id=1, query=WEATHER_QUERY, max_results=5)

    assert result["provider_search"] == "qwen_aliyun_weather_search_api"
    assert result["results"][0]["url"] == "https://www.weather.com.cn/weather/101200101.shtml"


def test_search_weather_with_qwen_api_parses_structured_results(monkeypatch):
    provider = SimpleNamespace(api_key="plain-token", timeout=15)
    captured = {}

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "result": {
                    "search_result": [
                        {
                            "title": "武汉天气",
                            "link": "https://www.weather.com.cn/weather/101200101.shtml",
                            "snippet": "今天夜里多云；明天晴到多云。",
                        }
                    ]
                }
            }

    def fake_post(url, json=None, headers=None, timeout=None):
        captured["url"] = url
        captured["json"] = json
        captured["headers"] = headers
        captured["timeout"] = timeout
        return FakeResponse()

    monkeypatch.setattr(httpx, "post", fake_post)

    result = WebSearchTool._search_weather_with_qwen_api(
        provider,
        {
            "web_search_host": "https://example.aliyun.com",
            "workspace_name": "default",
            "search_service_id": "ops-web-search-001",
        },
        WEATHER_QUERY,
        5,
    )

    assert captured["url"] == "https://example.aliyun.com/v3/openapi/workspaces/default/web-search/ops-web-search-001"
    assert captured["json"]["query"] == WEATHER_QUERY
    assert captured["json"]["top_k"] == 5
    assert captured["headers"]["Authorization"] == "Bearer plain-token"
    assert result["provider_search"] == "qwen_aliyun_weather_search_api"
    assert result["results"][0]["url"] == "https://www.weather.com.cn/weather/101200101.shtml"


@pytest.mark.asyncio
async def test_web_search_weather_query_falls_back_to_ddgs_after_official_failure(monkeypatch):
    tool = WebSearchTool()
    query_candidates = tool._build_query_candidates(WEATHER_QUERY)
    calls = []

    monkeypatch.setattr(
        tool,
        "_search_weather_with_official_provider_safe",
        lambda db, raw_query, max_results: (None, None),
    )

    class FakeDDGS:
        def text(self, query, **kwargs):
            calls.append((query, kwargs.get("region")))
            if query == query_candidates[0]:
                return []
            if query == query_candidates[1]:
                return [
                    {
                        "title": "武汉天气预报,武汉7天天气预报,武汉15天天气预报,武汉天气查询",
                        "body": "武汉今天气温、降水、风力预报。",
                        "href": "https://www.weather.com.cn/weather/101200101.shtml",
                    }
                ]
            return []

    monkeypatch.setitem(__import__("sys").modules, "ddgs", SimpleNamespace(DDGS=FakeDDGS))

    result = await tool.execute(db=object(), user_id=1, query=WEATHER_QUERY, max_results=5)

    assert calls == [
        (query_candidates[0], "cn-zh"),
        (query_candidates[1], "cn-zh"),
    ]
    assert result["query_used"] == query_candidates[1]
    assert result["results"][0]["url"] == "https://www.weather.com.cn/weather/101200101.shtml"


@pytest.mark.asyncio
async def test_web_search_weather_query_exposes_official_provider_error_on_fallback(monkeypatch):
    tool = WebSearchTool()
    query_candidates = tool._build_query_candidates(WEATHER_QUERY)

    monkeypatch.setattr(
        tool,
        "_search_weather_with_official_provider_safe",
        lambda db, raw_query, max_results: (
            None,
            {
                "provider": "doubao",
                "code": "ToolNotOpen",
                "status_code": 404,
                "message": "Your account has not activated web search.",
                "type": "HTTPStatusError",
            },
        ),
    )

    class FakeDDGS:
        def text(self, query, **kwargs):
            if query == query_candidates[0]:
                return []
            if query == query_candidates[1]:
                return [
                    {
                        "title": "姝︽眽澶╂皵棰勬姤,姝︽眽7澶╁ぉ姘旈鎶?姝︽眽15澶╁ぉ姘旈鎶?姝︽眽澶╂皵鏌ヨ",
                        "body": "weather forecast summary",
                        "href": "https://www.weather.com.cn/weather/101200101.shtml",
                    }
                ]
            return []

    monkeypatch.setitem(__import__("sys").modules, "ddgs", SimpleNamespace(DDGS=FakeDDGS))

    result = await tool.execute(db=object(), user_id=1, query=WEATHER_QUERY, max_results=5)

    assert result["results"][0]["url"] == "https://www.weather.com.cn/weather/101200101.shtml"
    assert result["provider_search_error"]["provider"] == "doubao"
    assert result["provider_search_error"]["code"] == "ToolNotOpen"


def test_extract_provider_error_details_from_http_status_error():
    request = httpx.Request("POST", "https://example.com/responses")
    response = httpx.Response(
        404,
        request=request,
        json={
            "error": {
                "code": "ToolNotOpen",
                "message": "Your account has not activated web search.",
            }
        },
    )
    exc = httpx.HTTPStatusError("boom", request=request, response=response)

    result = WebSearchTool._extract_provider_error_details(exc)

    assert result["code"] == "ToolNotOpen"
    assert result["status_code"] == 404
    assert "activated web search" in result["message"]
