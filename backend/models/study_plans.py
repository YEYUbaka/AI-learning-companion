"""
学习计划数据模型
"""
from sqlalchemy import Column, Integer, Text, DateTime
from sqlalchemy.sql import func
from database import Base


class StudyPlan(Base):
    """学习计划表"""
    __tablename__ = "study_plans"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True, comment="所属用户ID")
    goal = Column(Text, nullable=False, comment="用户学习目标")
    plan_json = Column(Text, nullable=False, comment="AI生成的学习计划（JSON字符串）")
    file_name = Column(Text, nullable=True, comment="上传的文件名（可选）")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), comment="更新时间")
    
    def __repr__(self):
        return f"<StudyPlan(id={self.id}, user_id={self.user_id}, goal={self.goal[:50]}...)>"

