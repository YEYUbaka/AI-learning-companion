"""
学习地图模块测试
"""
import json
import zipfile
from io import BytesIO
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


def test_serialize_graph_includes_extended_learning_map_fields(db_session):
    session_record = LearningMapRepository.create_session(
        db_session,
        user_id=1,
        topic="高中数学",
        provider="deepseek",
        file_id=None,
        source_preview="preview",
        map_mode="syllabus",
    )
    created_nodes = LearningMapRepository.create_nodes(
        db_session,
        user_id=1,
        session_id=session_record.id,
        file_id=None,
        nodes_data=[
            {
                "title": "函数",
                "description": "描述",
                "level": "foundation",
                "mastery": "medium",
                "example": "例题",
                "resources": json.dumps([]),
                "node_type": "chapter",
                "primary_parent": None,
                "source_excerpt": "教材第一章",
                "source_ref": "P1",
                "confidence": 0.92,
            },
            {
                "title": "二次函数",
                "description": "描述",
                "level": "intermediate",
                "mastery": "weak",
                "example": "例题",
                "resources": json.dumps([]),
                "node_type": "concept",
                "primary_parent": "函数",
                "source_excerpt": "教材第一章第二节",
                "source_ref": "P3",
                "confidence": 0.88,
            },
        ],
    )
    title_map = {node.title: node.id for node in created_nodes}
    LearningMapRepository.create_edges(
        db_session,
        user_id=1,
        session_id=session_record.id,
        edges_payload=[
            {
                "from": "函数",
                "to": "二次函数",
                "relation_type": "contains",
                "confidence": 0.9,
            }
        ],
        title_to_id=title_map,
    )

    graph = LearningMapService.get_graph(db_session, user_id=1, session_id=session_record.id)

    assert graph["session"]["map_mode"] == "syllabus"
    assert graph["nodes"][0]["node_type"] == "chapter"
    assert graph["nodes"][1]["primary_parent"] == "函数"
    assert graph["nodes"][1]["source_excerpt"] == "教材第一章第二节"
    assert graph["nodes"][1]["confidence"] == pytest.approx(0.88)
    assert graph["edges"][0]["relation_type"] == "contains"
    assert graph["edges"][0]["confidence"] == pytest.approx(0.9)


def test_export_xmind_builds_real_zip_package(db_session):
    session_record = LearningMapRepository.create_session(
        db_session,
        user_id=1,
        topic="牛顿定律",
        provider="deepseek",
        file_id=None,
        source_preview="preview",
        map_mode="document",
    )
    created_nodes = LearningMapRepository.create_nodes(
        db_session,
        user_id=1,
        session_id=session_record.id,
        file_id=None,
        nodes_data=[
            {
                "title": "牛顿定律",
                "description": "根节点",
                "level": "foundation",
                "mastery": "medium",
                "example": "例题",
                "resources": json.dumps([]),
                "node_type": "topic",
                "primary_parent": None,
                "source_excerpt": "材料摘要",
                "source_ref": "ref-1",
                "confidence": 0.95,
            },
            {
                "title": "牛顿第二定律",
                "description": "F=ma",
                "level": "intermediate",
                "mastery": "weak",
                "example": "斜面问题",
                "resources": json.dumps([{"title": "教材", "url": "https://example.com"}]),
                "node_type": "concept",
                "primary_parent": "牛顿定律",
                "source_excerpt": "第二页",
                "source_ref": "ref-2",
                "confidence": 0.93,
            },
            {
                "title": "惯性",
                "description": "相关概念",
                "level": "foundation",
                "mastery": "medium",
                "example": "小车实验",
                "resources": json.dumps([]),
                "node_type": "concept",
                "primary_parent": None,
                "source_excerpt": "第三页",
                "source_ref": "ref-3",
                "confidence": 0.84,
            },
        ],
    )
    title_map = {node.title: node.id for node in created_nodes}
    LearningMapRepository.create_edges(
        db_session,
        user_id=1,
        session_id=session_record.id,
        edges_payload=[
            {
                "from": "牛顿定律",
                "to": "牛顿第二定律",
                "relation_type": "contains",
                "confidence": 0.96,
            },
            {
                "from": "牛顿第二定律",
                "to": "惯性",
                "relation_type": "related",
                "confidence": 0.75,
            },
        ],
        title_to_id=title_map,
    )

    export_result = LearningMapService.export_learning_map(
        db_session,
        user_id=1,
        session_id=session_record.id,
        export_format="xmind",
    )

    archive = BytesIO(export_result["content"])
    with zipfile.ZipFile(archive) as zf:
        names = set(zf.namelist())
        assert "content.json" in names
        assert "metadata.json" in names
        assert "manifest.json" in names

        content = json.loads(zf.read("content.json").decode("utf-8"))
        root_topic = content[0]["rootTopic"]
        assert root_topic["title"] == "牛顿定律"
        child_titles = [item["title"] for item in root_topic["children"]["attached"]]
        assert "牛顿第二定律" in child_titles

        second_law = next(item for item in root_topic["children"]["attached"] if item["title"] == "牛顿第二定律")
        note_content = second_law["notes"]["plain"]["content"]
        assert "关联关系：牛顿第二定律 -> 惯性 (related)" in note_content

