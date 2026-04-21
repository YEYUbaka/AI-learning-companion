from services.rag_service import RAGService


class _FakeCollection:
    def __init__(self, results):
        self._results = results
        self.last_kwargs = None

    def count(self):
        return 5

    def query(self, **kwargs):
        self.last_kwargs = kwargs
        return self._results


def test_rag_search_filters_k12_results_for_java_query(monkeypatch):
    fake_results = {
        "documents": [["这里是高中英语写作模板内容"]],
        "metadatas": [[{
            "title": "高中英语核心知识点",
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


def test_rag_search_infers_subject_filter_for_math_query(monkeypatch):
    fake_results = {
        "documents": [[
            "三角函数常用公式整理",
            "英语阅读理解答题模板",
        ]],
        "metadatas": [[
            {
                "document_id": "101",
                "chunk_index": "1",
                "title": "初中数学三角函数公式",
                "grade_level": "初中",
                "subject": "数学",
                "topic": "三角函数",
                "section_title": "公式归纳",
                "image_paths": "[]",
            },
            {
                "document_id": "202",
                "chunk_index": "1",
                "title": "初中英语阅读理解",
                "grade_level": "初中",
                "subject": "英语",
                "topic": "阅读理解",
                "section_title": "答题技巧",
                "image_paths": "[]",
            },
        ]],
        "distances": [[0.08, 0.11]],
    }

    collection = _FakeCollection(fake_results)
    monkeypatch.setattr(RAGService, "get_collection", classmethod(lambda cls: collection))

    results = RAGService.search("初中数学常用三角函数解题公式有哪些", n_results=3)

    assert collection.last_kwargs["where"] == {
        "$and": [
            {"grade_level": {"$eq": "初中"}},
            {"subject": {"$eq": "数学"}},
        ]
    }
    assert len(results) == 1
    assert results[0].title == "初中数学三角函数公式"
