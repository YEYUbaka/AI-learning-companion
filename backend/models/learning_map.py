"""
知识图谱模型
作者：智学伴开发团队
"""
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    ForeignKey,
    DateTime,
    func,
)
from sqlalchemy.orm import relationship
from database import Base


class LearningMapFile(Base):
    """学习资料原始文本"""
    __tablename__ = "learning_map_files"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    file_path = Column(String(255), nullable=False)
    original_name = Column(String(255), nullable=True)
    raw_text = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    nodes = relationship("LearningNode", back_populates="source_file")
    sessions = relationship("LearningMapSession", back_populates="source_file")


class LearningMapSession(Base):
    """知识图谱生成记录"""
    __tablename__ = "learning_map_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    topic = Column(String(255), nullable=True)
    provider = Column(String(64), nullable=True)
    file_id = Column(Integer, ForeignKey("learning_map_files.id"), nullable=True)
    source_preview = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    source_file = relationship("LearningMapFile", back_populates="sessions")
    nodes = relationship(
        "LearningNode", back_populates="session", cascade="all, delete-orphan"
    )
    edges = relationship(
        "LearningEdge", back_populates="session", cascade="all, delete-orphan"
    )


class LearningNode(Base):
    """知识节点"""
    __tablename__ = "learning_nodes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    session_id = Column(
        Integer,
        ForeignKey("learning_map_sessions.id"),
        nullable=False,
        index=True,
    )
    file_id = Column(Integer, ForeignKey("learning_map_files.id"), nullable=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    level = Column(String(64), nullable=True)
    mastery = Column(String(32), nullable=True, default="unknown")
    example = Column(Text, nullable=True)
    resources = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("LearningMapSession", back_populates="nodes")
    source_file = relationship("LearningMapFile", back_populates="nodes")
    outgoing_edges = relationship(
        "LearningEdge",
        foreign_keys="LearningEdge.from_node_id",
        back_populates="from_node",
        cascade="all, delete",
    )
    incoming_edges = relationship(
        "LearningEdge",
        foreign_keys="LearningEdge.to_node_id",
        back_populates="to_node",
        cascade="all, delete",
    )


class LearningEdge(Base):
    """知识点依赖"""
    __tablename__ = "learning_edges"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    session_id = Column(
        Integer,
        ForeignKey("learning_map_sessions.id"),
        nullable=False,
        index=True,
    )
    from_node_id = Column(Integer, ForeignKey("learning_nodes.id"), nullable=False)
    to_node_id = Column(Integer, ForeignKey("learning_nodes.id"), nullable=False)
    relation = Column(String(255), nullable=False, default="depends_on")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("LearningMapSession", back_populates="edges")
    from_node = relationship(
        "LearningNode", foreign_keys=[from_node_id], back_populates="outgoing_edges"
    )
    to_node = relationship(
        "LearningNode", foreign_keys=[to_node_id], back_populates="incoming_edges"
    )


__all__ = [
    "LearningMapFile",
    "LearningMapSession",
    "LearningNode",
    "LearningEdge",
]

