"""
测评数据模型
"""
from sqlalchemy import Column, Integer, Text, DateTime
from sqlalchemy.sql import func
from database import Base


class Quiz(Base):
    """测评记录表"""
    __tablename__ = "quizzes"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True, comment="用户ID")
    topic = Column(Text, nullable=True, comment="测验主题")
    questions = Column(Text, nullable=False, comment="题目列表（JSON字符串）")
    answers = Column(Text, nullable=False, comment="用户答案列表（JSON字符串）")
    score = Column(Integer, nullable=False, comment="得分（0-100）")
    explanations = Column(Text, nullable=False, comment="讲解内容（JSON字符串）")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    
    def __repr__(self):
        return f"<Quiz(id={self.id}, user_id={self.user_id}, topic={self.topic}, score={self.score})>"

