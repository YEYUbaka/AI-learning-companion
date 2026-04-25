"""
试卷与试卷模板数据模型。
"""
from sqlalchemy import Boolean, Column, DateTime, Integer, JSON, String, Text
from sqlalchemy.sql import func

from database import Base


class QuizPaper(Base):
    __tablename__ = "quiz_papers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True, comment="用户ID")
    title = Column(String(200), nullable=False, comment="试卷标题")
    subject = Column(String(50), nullable=True, comment="科目")
    grade_level = Column(String(20), nullable=True, comment="学段")

    total_questions = Column(Integer, nullable=False, default=20, comment="总题数")
    difficulty_distribution = Column(JSON, nullable=True, comment="难度分布")
    question_type_distribution = Column(JSON, nullable=True, comment="题型分布")
    question_type_scores = Column(JSON, nullable=True, comment="题型单题分值")
    knowledge_points = Column(JSON, nullable=True, comment="知识点列表")

    questions = Column(JSON, nullable=False, comment="题目列表")
    answer_key = Column(JSON, nullable=True, comment="标准答案")
    source_stats = Column(JSON, nullable=True, comment="题目来源统计")
    coverage_report = Column(JSON, nullable=True, comment="覆盖报告")
    missing_requirements = Column(JSON, nullable=True, comment="缺口信息")

    paper_type = Column(String(20), nullable=False, default="custom", comment="试卷类型")
    time_limit = Column(Integer, nullable=True, comment="考试时长（分钟）")
    total_score = Column(Integer, nullable=False, default=100, comment="总分")

    is_template = Column(Boolean, default=False, comment="是否为模板")
    is_published = Column(Boolean, default=False, comment="是否已发布")

    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), comment="更新时间")

    def __repr__(self):
        return f"<QuizPaper(id={self.id}, title={self.title}, user_id={self.user_id})>"


class PaperTemplate(Base):
    __tablename__ = "paper_templates"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True, comment="用户ID")
    name = Column(String(100), nullable=False, comment="模板名称")
    description = Column(Text, nullable=True, comment="模板描述")
    paper_title = Column(String(200), nullable=True, comment="预设试卷标题")

    subject = Column(String(50), nullable=True, comment="科目")
    grade_level = Column(String(20), nullable=True, comment="学段")
    total_questions = Column(Integer, nullable=False, default=20, comment="总题数")
    difficulty_distribution = Column(JSON, nullable=True, comment="难度分布")
    question_type_distribution = Column(JSON, nullable=True, comment="题型分布")
    question_type_scores = Column(JSON, nullable=True, comment="题型单题分值")
    knowledge_points = Column(JSON, nullable=True, comment="知识点列表")
    time_limit = Column(Integer, nullable=True, comment="考试时长（分钟）")
    total_score = Column(Integer, nullable=False, default=100, comment="总分")

    usage_count = Column(Integer, default=0, comment="使用次数")

    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), comment="更新时间")

    def __repr__(self):
        return f"<PaperTemplate(id={self.id}, name={self.name}, user_id={self.user_id})>"
