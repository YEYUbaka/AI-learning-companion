"""
学习地图模块测试
"""
import json
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base
from repositories.learning_map_repo import LearningMapRepository
from services.learning_map_service import LearningMapService


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)


def test_create_and_fetch_file(db_session):
    record = LearningMapRepository.create_file(
        db_session,
        user_id=1,
        file_path="/tmp/demo.txt",
        raw_text="knowledge",
        original_name="demo.txt",
    )
    fetched = LearningMapRepository.get_file(db_session, record.id, 1)
    assert fetched is not None
    assert fetched.original_name == "demo.txt"


def test_session_graph_flow(db_session):
    file_record = LearningMapRepository.create_file(
        db_session, 1, "/tmp/a.txt", "text", "a.txt"
    )
    session_record = LearningMapRepository.create_session(
        db_session,
        user_id=1,
        topic="demo topic",
        provider="deepseek",
        file_id=file_record.id,
        source_preview="text",
    )
    nodes = [
        {"title": "A", "description": "desc", "level": "foundation", "mastery": "weak"},
        {
            "title": "B",
            "description": "desc",
            "level": "intermediate",
            "mastery": "medium",
        },
    ]
    edges = [{"from": "A", "to": "B", "relation": "depends"}]

    created_nodes = LearningMapRepository.create_nodes(
        db_session, 1, session_record.id, nodes, file_record.id
    )
    title_map = {node.title: node.id for node in created_nodes}
    created_edges = LearningMapRepository.create_edges(
        db_session, 1, session_record.id, edges, title_map
    )

    assert len(created_nodes) == 2
    assert len(created_edges) == 1

    fetched_nodes, fetched_edges = LearningMapRepository.get_graph_by_session(
        db_session, 1, session_record
    )
    assert len(fetched_nodes) == 2
    assert len(fetched_edges) == 1


def test_history_listing(db_session):
    session_ids = []
    for idx in range(3):
        session_record = LearningMapRepository.create_session(
            db_session,
            user_id=1,
            topic=f"topic {idx}",
            provider="demo",
            file_id=None,
            source_preview="preview",
        )
        session_ids.append(session_record.id)
    history = LearningMapService.get_history(db_session, 1, limit=5)
    assert len(history) == 3
    assert history[0]["id"] == session_ids[-1]


def test_parse_ai_response():
    text = """
    ```json
    {
      "nodes": [{"title":"A","description":"desc"}],
      "edges": [{"from":"A","to":"A","relation":"self"}]
    }
    ```
    """
    result = LearningMapService._extract_json(text)
    assert "nodes" in result
    assert result["nodes"][0]["title"] == "A"

