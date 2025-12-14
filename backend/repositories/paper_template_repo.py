"""
试卷模板数据仓库
作者：智学伴开发团队
目的：试卷模板数据访问层
"""
from typing import Optional, List
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
from core.logger import logger
from database import engine
from models.quiz_paper import PaperTemplate


def _ensure_paper_title_column() -> None:
    """确保 paper_templates 表存在 paper_title 列（兼容旧数据库）"""
    try:
        inspector = inspect(engine)
        if "paper_templates" not in inspector.get_table_names():
            return
        column_names = {col["name"] for col in inspector.get_columns("paper_templates")}
        if "paper_title" not in column_names:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE paper_templates ADD COLUMN paper_title VARCHAR(200)"))
            logger.info("已为 paper_templates 表新增 paper_title 列")
    except Exception as exc:
        logger.warning("检测/新增 paper_title 列失败: %s", exc)


_ensure_paper_title_column()


class PaperTemplateRepository:
    """试卷模板数据仓库类"""
    
    @staticmethod
    def create(db: Session, **kwargs) -> PaperTemplate:
        """创建模板"""
        template = PaperTemplate(**kwargs)
        db.add(template)
        db.commit()
        db.refresh(template)
        return template
    
    @staticmethod
    def get_by_id(db: Session, template_id: int, user_id: Optional[int] = None) -> Optional[PaperTemplate]:
        """根据ID获取模板"""
        query = db.query(PaperTemplate).filter(PaperTemplate.id == template_id)
        if user_id:
            query = query.filter(PaperTemplate.user_id == user_id)
        return query.first()
    
    @staticmethod
    def list_by_user(db: Session, user_id: int) -> List[PaperTemplate]:
        """获取用户的模板列表"""
        return db.query(PaperTemplate)\
            .filter(PaperTemplate.user_id == user_id)\
            .order_by(PaperTemplate.created_at.desc())\
            .all()
    
    @staticmethod
    def update_usage_count(db: Session, template_id: int):
        """更新模板使用次数"""
        template = db.query(PaperTemplate).filter(PaperTemplate.id == template_id).first()
        if template:
            template.usage_count = (template.usage_count or 0) + 1
            db.commit()
    
    @staticmethod
    def delete(db: Session, template_id: int, user_id: int) -> bool:
        """删除模板"""
        template = PaperTemplateRepository.get_by_id(db, template_id, user_id)
        if template:
            db.delete(template)
            db.commit()
            return True
        return False

