"""
试卷数据访问层。
"""
from typing import List, Optional

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from core.logger import logger
from database import engine
from models.quiz_paper import QuizPaper


def _ensure_quiz_paper_columns() -> None:
    """兼容旧数据库，为新增列补迁移。"""
    try:
        inspector = inspect(engine)
        if "quiz_papers" not in inspector.get_table_names():
            return

        column_names = {col["name"] for col in inspector.get_columns("quiz_papers")}
        desired_columns = {
            "question_type_scores": "ALTER TABLE quiz_papers ADD COLUMN question_type_scores JSON",
            "source_stats": "ALTER TABLE quiz_papers ADD COLUMN source_stats JSON",
            "coverage_report": "ALTER TABLE quiz_papers ADD COLUMN coverage_report JSON",
            "missing_requirements": "ALTER TABLE quiz_papers ADD COLUMN missing_requirements JSON",
        }
        for column_name, ddl in desired_columns.items():
            if column_name not in column_names:
                with engine.begin() as conn:
                    conn.execute(text(ddl))
                logger.info("Added %s column to quiz_papers", column_name)
                column_names.add(column_name)
    except Exception as exc:
        logger.warning("Failed to ensure quiz_papers columns: %s", exc)


_ensure_quiz_paper_columns()


class QuizPaperRepository:
    @staticmethod
    def create(db: Session, **kwargs) -> QuizPaper:
        paper = QuizPaper(**kwargs)
        db.add(paper)
        db.commit()
        db.refresh(paper)
        return paper

    @staticmethod
    def get_by_id(db: Session, paper_id: int, user_id: Optional[int] = None) -> Optional[QuizPaper]:
        query = db.query(QuizPaper).filter(QuizPaper.id == paper_id)
        if user_id:
            query = query.filter(QuizPaper.user_id == user_id)
        return query.first()

    @staticmethod
    def list_by_user(db: Session, user_id: int, skip: int = 0, limit: int = 20) -> List[QuizPaper]:
        return (
            db.query(QuizPaper)
            .filter(QuizPaper.user_id == user_id)
            .order_by(QuizPaper.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    @staticmethod
    def delete(db: Session, paper_id: int, user_id: int) -> bool:
        paper = QuizPaperRepository.get_by_id(db, paper_id, user_id)
        if not paper:
            return False

        db.delete(paper)
        db.commit()
        return True

    @staticmethod
    def update_generated_content(
        db: Session,
        paper_id: int,
        user_id: int,
        *,
        questions,
        answer_key,
        total_questions: Optional[int] = None,
        source_stats=None,
        coverage_report=None,
        missing_requirements=None,
    ) -> Optional[QuizPaper]:
        paper = QuizPaperRepository.get_by_id(db, paper_id, user_id)
        if not paper:
            return None

        paper.questions = questions
        paper.answer_key = answer_key
        if total_questions is not None:
            paper.total_questions = total_questions
        if source_stats is not None:
            paper.source_stats = source_stats
        if coverage_report is not None:
            paper.coverage_report = coverage_report
        if missing_requirements is not None:
            paper.missing_requirements = missing_requirements
        db.commit()
        db.refresh(paper)
        return paper
