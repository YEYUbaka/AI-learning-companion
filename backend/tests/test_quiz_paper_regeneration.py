import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from repositories.quiz_paper_repo import QuizPaperRepository
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


def test_regenerate_paper_questions_updates_persisted_paper(db_session, monkeypatch):
    config = _base_config()
    blueprint = QuizPaperService.build_blueprint(config)
    questions = [
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
    paper = QuizPaperRepository.create(
        db=db_session,
        user_id=1,
        title=config["title"],
        subject=config["subject"],
        grade_level=config["grade_level"],
        total_questions=len(questions),
        difficulty_distribution=blueprint["summary"]["difficulty_distribution"],
        question_type_distribution=blueprint["summary"]["question_type_distribution"],
        knowledge_points=config["knowledge_points"],
        questions=questions,
        answer_key=QuizPaperService._generate_answer_key(questions),
        paper_type=config["mode"],
        time_limit=config["time_limit"],
        total_score=config["total_score"],
    )
    captured = {}

    def fake_regenerate_failed_questions(db, config_data, blueprint_data, original_questions, failed_question_ids):
        captured["ids"] = failed_question_ids
        return failed_question_ids, [
            original_questions[0],
            {
                "question_id": "Q2",
                "type": "fill",
                "stem": "重生后的题目2",
                "options": [],
                "answer": "2",
                "explanation": "补全解析",
                "difficulty": "hard",
                "knowledge_points": ["导数"],
                "source_type": "ai_generated",
                "quality_score": 80,
            },
        ]

    monkeypatch.setattr(
        QuizPaperService,
        "regenerate_failed_questions",
        staticmethod(fake_regenerate_failed_questions),
    )

    result = QuizPaperService.regenerate_paper_questions(
        db=db_session,
        paper_id=paper.id,
        user_id=1,
    )

    updated_paper = QuizPaperRepository.get_by_id(db_session, paper.id, 1)
    assert captured["ids"] == ["Q2"]
    assert result["regenerated_question_ids"] == ["Q2"]
    assert updated_paper.questions[1]["stem"] == "重生后的题目2"
    assert updated_paper.answer_key[1]["answer"] == "2"
