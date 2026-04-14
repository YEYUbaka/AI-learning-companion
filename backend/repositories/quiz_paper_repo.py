"""
试卷数据仓库
作者：智学伴开发团队
目的：试卷数据访问层
"""
from typing import Optional, List
from sqlalchemy.orm import Session
from models.quiz_paper import QuizPaper


class QuizPaperRepository:
    """试卷数据仓库类"""
    
    @staticmethod
    def create(db: Session, **kwargs) -> QuizPaper:
        """创建试卷"""
        paper = QuizPaper(**kwargs)
        db.add(paper)
        db.commit()
        db.refresh(paper)
        return paper
    
    @staticmethod
    def get_by_id(db: Session, paper_id: int, user_id: Optional[int] = None) -> Optional[QuizPaper]:
        """根据ID获取试卷"""
        query = db.query(QuizPaper).filter(QuizPaper.id == paper_id)
        if user_id:
            query = query.filter(QuizPaper.user_id == user_id)
        return query.first()
    
    @staticmethod
    def list_by_user(
        db: Session,
        user_id: int,
        skip: int = 0,
        limit: int = 20
    ) -> List[QuizPaper]:
        """获取用户的试卷列表"""
        return db.query(QuizPaper)\
            .filter(QuizPaper.user_id == user_id)\
            .order_by(QuizPaper.created_at.desc())\
            .offset(skip)\
            .limit(limit)\
            .all()
    
    @staticmethod
    def delete(db: Session, paper_id: int, user_id: int) -> bool:
        """删除试卷"""
        paper = QuizPaperRepository.get_by_id(db, paper_id, user_id)
        if paper:
            db.delete(paper)
            db.commit()
            return True
        return False

    @staticmethod
    def update_generated_content(
        db: Session,
        paper_id: int,
        user_id: int,
        *,
        questions,
        answer_key,
        total_questions: Optional[int] = None,
    ) -> Optional[QuizPaper]:
        """鏇存柊璇曞嵎鐨勯鐩€佺瓟妗堝拰棰樼洰鏁伴噺"""
        paper = QuizPaperRepository.get_by_id(db, paper_id, user_id)
        if not paper:
            return None

        paper.questions = questions
        paper.answer_key = answer_key
        if total_questions is not None:
            paper.total_questions = total_questions
        db.commit()
        db.refresh(paper)
        return paper

