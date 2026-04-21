from types import SimpleNamespace

import pytest

from services.rag_service import RAGService
from utils.agent_tools import SearchKnowledgeTool


JAVA_LEARNING_PATH_QUERY = (
    "\u5e2e\u6211\u63a8\u8350\u4e00\u4e2a\u80fd\u591f\u8fbe\u5230"
    "\u9762\u8bd5\u7a0b\u5ea6\u7684Java\u5b66\u4e60\u8def\u5f84"
)


def test_search_knowledge_rewrite_query_for_java_learning_path():
    rewritten = SearchKnowledgeTool.rewrite_query(JAVA_LEARNING_PATH_QUERY)

    assert rewritten == "Java \u9762\u8bd5 \u5b66\u4e60\u8def\u5f84 \u8def\u7ebf\u56fe"


def test_search_knowledge_rewrite_query_keeps_subject_filters():
    rewritten = SearchKnowledgeTool.rewrite_query(
        "\u5e2e\u6211\u68b3\u7406\u725b\u987f\u7b2c\u4e8c\u5b9a\u5f8b\u7684\u77e5\u8bc6\u70b9\u548c\u4f8b\u9898",
        grade_level="\u9ad8\u4e2d",
        subject="\u7269\u7406",
    )

    assert rewritten.startswith("\u9ad8\u4e2d \u7269\u7406")


def test_search_knowledge_build_query_candidates_adds_expanded_and_raw_queries():
    candidates = SearchKnowledgeTool.build_query_candidates(JAVA_LEARNING_PATH_QUERY)

    assert candidates[0] == "Java \u9762\u8bd5 \u5b66\u4e60\u8def\u5f84 \u8def\u7ebf\u56fe"
    assert candidates[-1] == JAVA_LEARNING_PATH_QUERY
    assert any("\u540e\u7aef" in candidate for candidate in candidates[1:])


def test_search_knowledge_rewrite_query_keeps_example_intent_terms():
    rewritten = SearchKnowledgeTool.rewrite_query(
        f"{JAVA_LEARNING_PATH_QUERY} \u4f8b\u9898 \u771f\u9898"
    )

    assert "\u4f8b\u9898" in rewritten
    assert "\u771f\u9898" in rewritten


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
                title="Java \u9762\u8bd5\u5b66\u4e60\u8def\u7ebf",
                subject="",
                grade_level="",
                section_title="\u8def\u7ebf\u5efa\u8bae",
                text="Java \u9762\u8bd5\u5b66\u4e60\u8def\u7ebf\u5efa\u8bae",
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
