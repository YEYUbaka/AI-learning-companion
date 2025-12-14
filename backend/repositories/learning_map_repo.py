"""
学习地图仓储
作者：智学伴开发团队
"""
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc
from models.learning_map import (
    LearningMapFile,
    LearningMapSession,
    LearningNode,
    LearningEdge,
)


class LearningMapRepository:
    """封装知识图谱相关的数据库操作"""

    @staticmethod
    def create_file(
        db: Session, user_id: int, file_path: str, raw_text: str, original_name: str
    ) -> LearningMapFile:
        record = LearningMapFile(
            user_id=user_id,
            file_path=file_path,
            raw_text=raw_text,
            original_name=original_name,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def get_file(db: Session, file_id: int, user_id: int) -> Optional[LearningMapFile]:
        return (
            db.query(LearningMapFile)
            .filter(
                LearningMapFile.id == file_id,
                LearningMapFile.user_id == user_id,
            )
            .first()
        )

    @staticmethod
    def create_session(
        db: Session,
        user_id: int,
        topic: Optional[str],
        provider: Optional[str],
        file_id: Optional[int],
        source_preview: Optional[str],
    ) -> LearningMapSession:
        session = LearningMapSession(
            user_id=user_id,
            topic=topic,
            provider=provider,
            file_id=file_id,
            source_preview=source_preview,
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return session

    @staticmethod
    def list_sessions(
        db: Session, user_id: int, limit: int = 20
    ) -> List[LearningMapSession]:
        return (
            db.query(LearningMapSession)
            .filter(LearningMapSession.user_id == user_id)
            .order_by(desc(LearningMapSession.created_at))
            .limit(limit)
            .all()
        )

    @staticmethod
    def get_session(
        db: Session, user_id: int, session_id: int
    ) -> Optional[LearningMapSession]:
        return (
            db.query(LearningMapSession)
            .filter(
                LearningMapSession.user_id == user_id,
                LearningMapSession.id == session_id,
            )
            .first()
        )

    @staticmethod
    def get_latest_session(db: Session, user_id: int) -> Optional[LearningMapSession]:
        return (
            db.query(LearningMapSession)
            .filter(LearningMapSession.user_id == user_id)
            .order_by(desc(LearningMapSession.created_at))
            .first()
        )

    @staticmethod
    def delete_session(db: Session, user_id: int, session_id: int) -> bool:
        """
        删除知识图谱会话（会自动级联删除相关的 nodes 和 edges）
        """
        session = (
            db.query(LearningMapSession)
            .filter(
                LearningMapSession.id == session_id,
                LearningMapSession.user_id == user_id,
            )
            .first()
        )
        if not session:
            return False
        db.delete(session)
        db.commit()
        return True

    @staticmethod
    def create_nodes(
        db: Session,
        user_id: int,
        session_id: int,
        nodes_data: List[Dict],
        file_id: Optional[int],
    ) -> List[LearningNode]:
        nodes = []
        for node_data in nodes_data:
            node = LearningNode(
                user_id=user_id,
                session_id=session_id,
                file_id=file_id,
                title=node_data.get("title"),
                description=node_data.get("description"),
                level=node_data.get("level"),
                mastery=node_data.get("mastery"),
                example=node_data.get("example"),
                resources=node_data.get("resources"),
            )
            db.add(node)
            nodes.append(node)
        db.commit()
        for node in nodes:
            db.refresh(node)
        return nodes

    @staticmethod
    def create_edges(
        db: Session,
        user_id: int,
        session_id: int,
        edges_payload: List[Dict],
        title_to_id: Dict[str, int],
    ) -> List[LearningEdge]:
        edges: List[LearningEdge] = []
        for edge in edges_payload:
            src = title_to_id.get(edge.get("from"))
            tgt = title_to_id.get(edge.get("to"))
            if not src or not tgt:
                continue
            relation = edge.get("relation") or "depends_on"
            record = LearningEdge(
                user_id=user_id,
                session_id=session_id,
                from_node_id=src,
                to_node_id=tgt,
                relation=relation[:255],
            )
            db.add(record)
            edges.append(record)
        db.commit()
        for edge in edges:
            db.refresh(edge)
        return edges

    @staticmethod
    def get_graph_by_session(
        db: Session, user_id: int, session: LearningMapSession
    ) -> Tuple[List[LearningNode], List[LearningEdge]]:
        nodes = (
            db.query(LearningNode)
            .filter(
                LearningNode.user_id == user_id,
                LearningNode.session_id == session.id,
            )
            .order_by(LearningNode.created_at.asc())
            .all()
        )
        edges = (
            db.query(LearningEdge)
            .filter(
                LearningEdge.user_id == user_id,
                LearningEdge.session_id == session.id,
            )
            .order_by(LearningEdge.created_at.asc())
            .all()
        )
        return nodes, edges

