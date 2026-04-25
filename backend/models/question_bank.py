"""
Question bank models.
"""
from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


class QuestionBankItem(Base):
    __tablename__ = "question_bank_items"

    id = Column(Integer, primary_key=True, index=True)
    stem = Column(Text, nullable=False)
    normalized_stem = Column(String(255), nullable=True, index=True)
    question_type = Column(String(50), nullable=False, index=True)
    grade_level = Column(String(50), nullable=True, index=True)
    subject = Column(String(50), nullable=True, index=True)
    difficulty = Column(String(20), nullable=True, index=True)
    knowledge_points = Column(JSON, nullable=True)
    answer = Column(JSON, nullable=False)
    explanation = Column(Text, nullable=True)
    options = Column(JSON, nullable=True)
    source = Column(String(255), nullable=True)
    source_type = Column(String(50), nullable=False, default="question_bank")
    status = Column(String(30), nullable=False, default="active", index=True)
    created_by = Column(Integer, nullable=True, index=True)
    metadata_json = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    assets = relationship(
        "QuestionBankAsset",
        back_populates="item",
        cascade="all, delete-orphan",
        order_by="QuestionBankAsset.sort_order.asc()",
    )


class QuestionBankAsset(Base):
    __tablename__ = "question_bank_assets"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("question_bank_items.id", ondelete="CASCADE"), nullable=False, index=True)
    asset_type = Column(String(50), nullable=False, index=True)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    mime_type = Column(String(100), nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    item = relationship("QuestionBankItem", back_populates="assets")
