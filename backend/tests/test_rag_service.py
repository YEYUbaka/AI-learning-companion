from services.rag_service import RAGService


class _FakeCollection:
    def __init__(self, results):
        self._results = results

    def count(self):
        return 5

    def query(self, **kwargs):
        return self._results


def test_rag_search_filters_k12_results_for_java_query(monkeypatch):
    fake_results = {
        "documents": [["这里是高中英语写作模板内容"]],
        "metadatas": [[{
            "title": "高中下册英语核心知识点",
            "grade_level": "高中",
            "subject": "英语",
            "topic": "写作",
            "section_title": "写作模板",
            "image_paths": "[]",
        }]],
        "distances": [[0.12]],
    }

    monkeypatch.setattr(RAGService, "get_collection", classmethod(lambda cls: _FakeCollection(fake_results)))

    results = RAGService.search("帮我推荐一个能够达到面试程度的Java学习路径", n_results=3)

    assert results == []


def test_rag_search_keeps_matching_java_results(monkeypatch):
    fake_results = {
        "documents": [["Java 面试学习路线建议：先打基础，再深入 JVM、并发、Spring。"]],
        "metadatas": [[{
            "title": "Java 面试学习路线",
            "grade_level": "",
            "subject": "",
            "topic": "Java 面试",
            "section_title": "路线建议",
            "image_paths": "[]",
        }]],
        "distances": [[0.12]],
    }

    monkeypatch.setattr(RAGService, "get_collection", classmethod(lambda cls: _FakeCollection(fake_results)))

    results = RAGService.search("帮我推荐一个能够达到面试程度的Java学习路径", n_results=3)

    assert len(results) == 1
    assert results[0].title == "Java 面试学习路线"
