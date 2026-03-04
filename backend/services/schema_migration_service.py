"""
数据库结构迁移服务
负责在启动时自动校验/修补学习图谱相关表结构，避免因 schema 变更导致 500
"""
from datetime import datetime
from sqlalchemy import inspect, text
from sqlalchemy.exc import NoSuchTableError, OperationalError

from core.logger import logger
from database import engine, SessionLocal
from models.learning_map import (
    LearningMapSession,
    LearningNode,
    LearningEdge,
)


class SchemaMigrationService:
    """运行时轻量级 schema 校验/迁移"""

    @staticmethod
    def ensure_learning_map_history_schema() -> None:
        """
        确保学习图谱相关表结构满足最新版需求：
        - 存在 learning_map_sessions 表
        - learning_nodes / learning_edges 包含 session_id 字段
        - 旧数据补写 session_id，保证后续查询不报错
        """
        try:
            SchemaMigrationService._ensure_sessions_table()
            SchemaMigrationService._ensure_column("learning_nodes", "session_id")
            SchemaMigrationService._ensure_column("learning_edges", "session_id")
            SchemaMigrationService._backfill_legacy_sessions()
        except Exception as exc:  # pylint: disable=broad-except
            logger.error("学习图谱 schema 自动迁移失败: %s", exc, exc_info=True)

    @staticmethod
    def _ensure_sessions_table() -> None:
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        if "learning_map_sessions" in tables:
            return
        logger.info("检测到缺失 learning_map_sessions 表，正在自动创建...")
        LearningMapSession.__table__.create(bind=engine, checkfirst=True)
        logger.info("learning_map_sessions 表创建完成")

    @staticmethod
    def _ensure_column(table_name: str, column_name: str) -> None:
        try:
            inspector = inspect(engine)
            columns = {col["name"] for col in inspector.get_columns(table_name)}
        except NoSuchTableError:
            logger.warning("表 %s 不存在，跳过列 %s 检查", table_name, column_name)
            return

        if column_name in columns:
            return

        logger.info("为表 %s 自动新增列 %s ...", table_name, column_name)
        ddl = text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} INTEGER")
        with engine.begin() as conn:
            conn.execute(ddl)
        logger.info("表 %s 列 %s 创建完成", table_name, column_name)

    @staticmethod
    def _backfill_legacy_sessions() -> None:
        """
        兼容历史数据：为 session_id 为空的节点/边创建补偿会话，保证后续查询正常
        """
        db = SessionLocal()
        try:
            legacy_users = (
                db.query(LearningNode.user_id)
                .filter((LearningNode.session_id.is_(None)) | (LearningNode.session_id == 0))
                .distinct()
                .all()
            )
            if not legacy_users:
                return

            logger.info("检测到 %s 个存在历史节点的用户，需要补写 session_id", len(legacy_users))
            for (user_id,) in legacy_users:
                session = LearningMapSession(
                    user_id=user_id,
                    topic="历史知识图谱",
                    provider=None,
                    file_id=None,
                    source_preview="系统自动迁移的历史数据",
                    created_at=datetime.utcnow(),
                )
                db.add(session)
                db.flush()

                (
                    db.query(LearningNode)
                    .filter(
                        LearningNode.user_id == user_id,
                        (LearningNode.session_id.is_(None)) | (LearningNode.session_id == 0),
                    )
                    .update({"session_id": session.id}, synchronize_session=False)
                )
                (
                    db.query(LearningEdge)
                    .filter(
                        LearningEdge.user_id == user_id,
                        (LearningEdge.session_id.is_(None)) | (LearningEdge.session_id == 0),
                    )
                    .update({"session_id": session.id}, synchronize_session=False)
                )

            db.commit()
            logger.info("历史节点/边 session_id 补写完成")
        except OperationalError as exc:
            db.rollback()
            logger.error("历史数据补写失败: %s", exc, exc_info=True)
        finally:
            db.close()

