"""
知识库数据模型
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class KnowledgeDocument(Base):
    """知识库文档"""
    __tablename__ = "knowledge_documents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    file_path = Column(String(767), unique=True, nullable=False)  # MySQL utf8mb4 唯一索引上限 767 chars
    grade_level = Column(String(50), nullable=True)   # 小学/初中/高中/大学/通用
    subject = Column(String(100), nullable=True)      # 数学/物理/化学/...
    topic = Column(String(500), nullable=True)        # 文档核心主题
    difficulty = Column(String(20), nullable=True)    # easy/medium/hard
    source = Column(String(500), nullable=True)       # 来源
    tags = Column(JSON, default=list)
    chunk_count = Column(Integer, default=0)
    status = Column(String(20), default="pending")    # pending/indexed/failed
    error_message = Column(Text, nullable=True)
    indexed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    chunks = relationship("KnowledgeChunk", back_populates="document", cascade="all, delete-orphan")


class KnowledgeChunk(Base):
    """知识库文档分块"""
    __tablename__ = "knowledge_chunks"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("knowledge_documents.id"), nullable=False)
    chroma_id = Column(String(200), unique=True, nullable=False)  # ChromaDB 中的唯一 ID
    chunk_index = Column(Integer, nullable=False)
    section_title = Column(String(500), nullable=True)
    content_preview = Column(String(500), nullable=True)          # 内容预览（前200字）
    image_paths = Column(JSON, default=list)                      # 关联图片路径列表
    char_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("KnowledgeDocument", back_populates="chunks")
