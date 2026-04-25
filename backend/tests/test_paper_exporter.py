from utils.paper_exporter import PaperExporter


def test_normalize_answer_key_accepts_list_payload():
    answer_key = [
        {"question_id": "Q1", "answer": "A"},
        {"question_id": "Q2", "answer": "B"},
    ]

    normalized = PaperExporter._normalize_answer_key(answer_key)

    assert normalized["1"]["answer"] == "A"
    assert normalized["2"]["answer"] == "B"


def test_normalize_export_questions_uses_stem_as_fallback():
    questions = [{"stem": "已知函数 f(x) 的定义域是？", "points": 6}]

    normalized = PaperExporter._normalize_export_questions(questions)

    assert normalized[0]["question"] == "已知函数 f(x) 的定义域是？"
    assert normalized[0]["points"] == 6
