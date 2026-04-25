from types import SimpleNamespace

import pytest

from services.rag_service import RAGService
from utils.agent_tools import SearchKnowledgeTool


JAVA_LEARNING_PATH_QUERY = "\u5e2e\u6211\u63a8\u8350\u4e00\u4e2a\u80fd\u591f\u8fbe\u5230\u9762\u8bd5\u7a0b\u5ea6\u7684Java\u5b66\u4e60\u8def\u5f84"
MATH_FORMULA_QUERY = "\u521d\u4e2d\u6570\u5b66\u5e38\u7528\u4e09\u89d2\u51fd\u6570\u89e3\u9898\u516c\u5f0f\u6709\u54ea\u4e9b"
UNIVERSITY_MATH_QUERY = "\u63a8\u8350\u51e0\u4e2a\u597d\u7684\u9ad8\u6570up\u4e3b"


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
    rewritten = SearchKnowledgeTool.rewrite_query(f"{JAVA_LEARNING_PATH_QUERY} \u4f8b\u9898 \u771f\u9898")

    assert "\u4f8b\u9898" in rewritten
    assert "\u771f\u9898" in rewritten


def test_rag_service_infers_university_math_filters():
    assert RAGService.infer_grade_level_from_query(UNIVERSITY_MATH_QUERY) == "\u5927\u5b66"
    assert RAGService.infer_subject_from_query(UNIVERSITY_MATH_QUERY) == "\u6570\u5b66"


def test_rag_service_search_filters_low_relevance_university_hits(monkeypatch):
    class FakeCollection:
        def count(self):
            return 8

        def query(self, **kwargs):
            return {
                "documents": [[
                    "\u9ad8\u7b49\u6570\u5b66\u8bfe\u7a0b\u63a8\u8350\uff0c\u9002\u5408\u5927\u5b66\u9636\u6bb5\u590d\u4e60\u5fae\u79ef\u5206\u3002",
                    "\u901a\u7528\u5b66\u4e60\u5efa\u8bae\uff0c\u4fdd\u6301\u7ec3\u4e60\u548c\u603b\u7ed3\u3002",
                ]],
                "metadatas": [[
                    {
                        "document_id": "11",
                        "chunk_index": "0",
                        "title": "\u9ad8\u7b49\u6570\u5b66\u8bfe\u7a0b\u63a8\u8350",
                        "grade_level": "\u5927\u5b66",
                        "subject": "\u6570\u5b66",
                        "topic": "\u9ad8\u7b49\u6570\u5b66",
                        "difficulty": "",
                        "source": "",
                        "section_title": "\u8bfe\u7a0b\u8d44\u6e90",
                        "image_paths": "[]",
                    },
                    {
                        "document_id": "12",
                        "chunk_index": "0",
                        "title": "\u5927\u5b66\u901a\u7528\u5b66\u4e60\u65b9\u6cd5",
                        "grade_level": "\u5927\u5b66",
                        "subject": "\u6570\u5b66",
                        "topic": "\u5b66\u4e60\u65b9\u6cd5",
                        "difficulty": "",
                        "source": "",
                        "section_title": "\u5efa\u8bae",
                        "image_paths": "[]",
                    },
                ]],
                "distances": [[0.22, 0.72]],
            }

    monkeypatch.setattr(RAGService, "get_collection", classmethod(lambda cls: FakeCollection()))

    results = RAGService.search(UNIVERSITY_MATH_QUERY, n_results=5)

    assert len(results) == 1
    assert results[0].title == "\u9ad8\u7b49\u6570\u5b66\u8bfe\u7a0b\u63a8\u8350"


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
                title="\u521d\u4e2d\u6570\u5b66\u4e09\u89d2\u51fd\u6570\u516c\u5f0f",
                subject="\u6570\u5b66",
                grade_level="\u521d\u4e2d",
                section_title="\u516c\u5f0f\u5f52\u7eb3",
                text="sin\u3001cos\u3001tan \u5e38\u7528\u516c\u5f0f",
                image_paths=[],
            )
        ]

    monkeypatch.setattr(RAGService, "search", classmethod(fake_search))

    result = await tool.execute(db=None, user_id=1, query=MATH_FORMULA_QUERY, limit=3)

    assert calls[0]["grade_level"] == "\u521d\u4e2d"
    assert calls[0]["subject"] == "\u6570\u5b66"
    assert result["grade_level_used"] == "\u521d\u4e2d"
    assert result["subject_used"] == "\u6570\u5b66"
    assert result["count"] == 1
