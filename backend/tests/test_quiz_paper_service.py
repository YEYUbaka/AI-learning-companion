"""
智能组卷服务测试
"""
import json

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from repositories.quiz_paper_repo import QuizPaperRepository
from services.ai_service import AIService
from services.quiz_paper_service import QuizPaperService


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)


def _base_config():
    return {
        "title": "高中数学测试卷",
        "subject": "数学",
        "grade_level": "高中",
        "total_questions": 6,
        "difficulty_distribution": {"easy": 30, "medium": 50, "hard": 20},
        "question_type_distribution": {"choice": 4, "fill": 2},
        "knowledge_points": ["函数", "导数"],
        "time_limit": 60,
        "total_score": 100,
        "mode": "teacher",
        "source_policy": "knowledge_first",
        "review_level": "strict",
    }


def test_build_blueprint_generates_complete_question_specs():
    blueprint = QuizPaperService.build_blueprint(_base_config())

    assert blueprint["mode"] == "teacher"
    assert blueprint["source_policy"] == "knowledge_first"
    assert blueprint["review_level"] == "strict"
    assert blueprint["total_questions"] == 6
    assert len(blueprint["question_specs"]) == 6
    assert blueprint["summary"]["question_type_distribution"]["choice"] == 4
    assert blueprint["summary"]["difficulty_distribution"]["medium"] >= 2


def test_review_generated_paper_reports_quality_warnings():
    blueprint = QuizPaperService.build_blueprint(_base_config())
    questions = [
        {
            "question_id": "Q1",
            "type": "choice",
            "stem": "下列函数中是一次函数的是？",
            "options": ["y=x", "y=x^2", "y=1/x", "y=|x|"],
            "answer": "A",
            "explanation": "一次函数形如 y=ax+b。",
            "difficulty": "easy",
            "knowledge_points": ["函数"],
            "source_type": "knowledge_base",
        },
        {
            "question_id": "Q2",
            "type": "choice",
            "stem": "下列函数中是一次函数的是？",
            "options": ["y=x", "y=x^2", "y=1/x", "y=|x|"],
            "answer": "",
            "explanation": "",
            "difficulty": "easy",
            "knowledge_points": ["函数"],
            "source_type": "ai_generated",
        },
    ]

    report = QuizPaperService.review_generated_paper(blueprint, questions, review_level="strict")

    assert report["quality_status"] in {"warning", "fail"}
    assert report["duplicate_rate"] > 0
    assert "函数" in report["coverage_knowledge_points"]
    warning_codes = {item["code"] for item in report["warnings"]}
    assert "duplicate_question" in warning_codes
    assert "missing_answer" in warning_codes


def test_generate_custom_paper_accepts_list_answers_from_ai(db_session, monkeypatch):
    config = _base_config()
    config["total_questions"] = 1
    config["difficulty_distribution"] = {"easy": 100, "medium": 0, "hard": 0}
    config["question_type_distribution"] = {"multiple_choice": 1}

    def fake_call_ai(**kwargs):
        return {
            "text": "",
            "raw": json.dumps(
                {
                    "questions": [
                        {
                            "question_id": "Q1",
                            "type": "multiple_choice",
                            "stem": "下列说法正确的是？",
                            "options": ["A. 选项1", "B. 选项2", "C. 选项3", "D. 选项4"],
                            "answer": ["A", "C"],
                            "explanation": "A 和 C 正确。",
                            "difficulty": "easy",
                            "knowledge_points": ["函数"],
                            "source_type": "knowledge_base",
                            "quality_score": 92,
                        }
                    ]
                },
                ensure_ascii=False,
            ),
        }

    monkeypatch.setattr(AIService, "call_ai", staticmethod(fake_call_ai))

    result = QuizPaperService.generate_custom_paper(
        db=db_session,
        user_id=1,
        config=config,
    )

    warning_codes = {item["code"] for item in result["quality_report"]["warnings"]}
    assert result["success"] is True
    assert result["questions"][0]["answer"] == ["A", "C"]
    assert result["quality_report"]["quality_status"] == "pass"
    assert "missing_answer" not in warning_codes


def test_regenerate_failed_questions_only_targets_failed_ids(monkeypatch):
    blueprint = QuizPaperService.build_blueprint(_base_config())
    original_questions = [
        {
            "question_id": "Q1",
            "type": "choice",
            "stem": "题目1",
            "options": ["A", "B", "C", "D"],
            "answer": "A",
            "explanation": "解析1",
            "difficulty": "easy",
            "knowledge_points": ["函数"],
            "source_type": "knowledge_base",
        },
        {
            "question_id": "Q2",
            "type": "fill",
            "stem": "题目2",
            "options": [],
            "answer": "",
            "explanation": "",
            "difficulty": "hard",
            "knowledge_points": ["导数"],
            "source_type": "ai_generated",
        },
    ]
    captured = {}

    def fake_generate_for_specs(db, config, blueprint_data, specs):
        captured["ids"] = [item["question_id"] for item in specs]
        return [
            {
                "question_id": "Q2",
                "type": "fill",
                "stem": "重生成题目2",
                "options": [],
                "answer": "2",
                "explanation": "新解析",
                "difficulty": "hard",
                "knowledge_points": ["导数"],
                "source_type": "ai_generated",
            }
        ]

    monkeypatch.setattr(QuizPaperService, "_generate_questions_for_specs", staticmethod(fake_generate_for_specs))

    regenerated_ids, regenerated_questions = QuizPaperService.regenerate_failed_questions(
        db=None,
        config=_base_config(),
        blueprint=blueprint,
        original_questions=original_questions,
        failed_question_ids=["Q2"],
    )

    assert regenerated_ids == ["Q2"]
    assert captured["ids"] == ["Q2"]
    regenerated = next(item for item in regenerated_questions if item["question_id"] == "Q2")
    assert regenerated["stem"] == "重生成题目2"
