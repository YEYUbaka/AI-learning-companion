"""
试卷模板数据访问层。
"""
from typing import List, Optional

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from core.logger import logger
from database import engine
from models.quiz_paper import PaperTemplate


def _ensure_template_columns() -> None:
    """兼容旧数据库，为新增列补迁移。"""
    try:
        inspector = inspect(engine)
        if "paper_templates" not in inspector.get_table_names():
            return

        column_names = {col["name"] for col in inspector.get_columns("paper_templates")}
        statements = []
        if "paper_title" not in column_names:
            statements.append("ALTER TABLE paper_templates ADD COLUMN paper_title VARCHAR(200)")
        if "question_type_scores" not in column_names:
            statements.append("ALTER TABLE paper_templates ADD COLUMN question_type_scores JSON")

        if statements:
            with engine.begin() as conn:
                for statement in statements:
                    conn.execute(text(statement))
            logger.info("Ensured compatibility columns for paper_templates")
    except Exception as exc:
        logger.warning("Failed to ensure paper_templates columns: %s", exc)


_ensure_template_columns()


class PaperTemplateRepository:
    @staticmethod
    def create(db: Session, **kwargs) -> PaperTemplate:
        template = PaperTemplate(**kwargs)
        db.add(template)
        db.commit()
        db.refresh(template)
        return template

    @staticmethod
    def get_by_id(db: Session, template_id: int, user_id: Optional[int] = None) -> Optional[PaperTemplate]:
        query = db.query(PaperTemplate).filter(PaperTemplate.id == template_id)
        if user_id:
            query = query.filter(PaperTemplate.user_id == user_id)
        return query.first()

    @staticmethod
    def list_by_user(db: Session, user_id: int) -> List[PaperTemplate]:
        return (
            db.query(PaperTemplate)
            .filter(PaperTemplate.user_id == user_id)
            .order_by(PaperTemplate.created_at.desc())
            .all()
        )

    @staticmethod
    def update_usage_count(db: Session, template_id: int):
        template = db.query(PaperTemplate).filter(PaperTemplate.id == template_id).first()
        if template:
            template.usage_count = (template.usage_count or 0) + 1
            db.commit()

    @staticmethod
    def delete(db: Session, template_id: int, user_id: int) -> bool:
        template = PaperTemplateRepository.get_by_id(db, template_id, user_id)
        if not template:
            return False

        db.delete(template)
        db.commit()
        return True
