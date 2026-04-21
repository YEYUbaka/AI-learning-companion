from types import SimpleNamespace

import pytest

from services.rag_service import RAGService
from utils.agent_tools import SearchKnowledgeTool


JAVA_LEARNING_PATH_QUERY = "帮我推荐一个能够达到面试程度的Java学习路径"
MATH_FORMULA_QUERY = "初中数学常用三角函数解题公式有哪些"


def test_search_knowledge_rewrite_query_for_java_learning_path():
    rewritten = SearchKnowledgeTool.rewrite_query(JAVA_LEARNING_PATH_QUERY)

    assert rewritten == "Java 面试 学习路径 路线图"


def test_search_knowledge_rewrite_query_keeps_subject_filters():
    rewritten = SearchKnowledgeTool.rewrite_query(
        "帮我梳理牛顿第二定律的知识点和例题",
        grade_level="高中",
        subject="物理",
    )

    assert rewritten.startswith("高中 物理")


def test_search_knowledge_build_query_candidates_adds_expanded_and_raw_queries():
    candidates = SearchKnowledgeTool.build_query_candidates(JAVA_LEARNING_PATH_QUERY)

    assert candidates[0] == "Java 面试 学习路径 路线图"
    assert candidates[-1] == JAVA_LEARNING_PATH_QUERY
    assert any("后端" in candidate for candidate in candidates[1:])


def test_search_knowledge_rewrite_query_keeps_example_intent_terms():
    rewritten = SearchKnowledgeTool.rewrite_query(f"{JAVA_LEARNING_PATH_QUERY} 例题 真题")

    assert "例题" in rewritten
    assert "真题" in rewritten


@pytest.mark.asyncio
async def test_search_knowledge_execute_tries_candidates_until_hit(monkeypatch):
    tool = SearchKnowledgeTool()
    candidates = SearchKnowledgeTool.build_query_candidates(JAVA_LEARNING_PATH_QUERY)
    calls = []

    def fake_search(cls, query, n_results=5, grade_level=None, subject=None):
        calls.append(query)
        if query != JAVA_LEARNING_PATH_QUERY:
            return []
        return [
            SimpleNamespace(
                document_id=42,
                chunk_index=3,
                title="Java 面试学习路线",
                subject="",
                grade_level="",
                section_title="路线建议",
                text="Java 面试学习路线建议",
                image_paths=[],
            )
        ]

    monkeypatch.setattr(RAGService, "search", classmethod(fake_search))

    result = await tool.execute(db=None, user_id=1, query=JAVA_LEARNING_PATH_QUERY, limit=5)

    assert calls == candidates
    assert result["query_used"] == JAVA_LEARNING_PATH_QUERY
    assert result["query_candidates"] == candidates
    assert result["fallback_used"] is True
    assert result["count"] == 1
    assert result["results"][0]["url"] == "/knowledge/documents/42?section=%E8%B7%AF%E7%BA%BF%E5%BB%BA%E8%AE%AE"
    assert result["evidence"][0]["url"] == "/knowledge/documents/42?section=%E8%B7%AF%E7%BA%BF%E5%BB%BA%E8%AE%AE"


@pytest.mark.asyncio
async def test_search_knowledge_execute_infers_k12_filters_from_query(monkeypatch):
    tool = SearchKnowledgeTool()
    calls = []

    def fake_search(cls, query, n_results=5, grade_level=None, subject=None):
        calls.append(
            {
                "query": query,
                "grade_level": grade_level,
                "subject": subject,
            }
        )
        return [
            SimpleNamespace(
                document_id=7,
                chunk_index=1,
                title="初中数学三角函数公式",
                subject="数学",
                grade_level="初中",
                section_title="公式归纳",
                text="sin、cos、tan 常用公式",
                image_paths=[],
            )
        ]

    monkeypatch.setattr(RAGService, "search", classmethod(fake_search))

    result = await tool.execute(db=None, user_id=1, query=MATH_FORMULA_QUERY, limit=3)

    assert calls[0]["grade_level"] == "初中"
    assert calls[0]["subject"] == "数学"
    assert result["grade_level_used"] == "初中"
    assert result["subject_used"] == "数学"
    assert result["count"] == 1
