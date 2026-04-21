"""
学习地图服务
"""
import ast
import json
import zipfile
from io import BytesIO
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from uuid import uuid4

from fastapi import UploadFile
from sqlalchemy.orm import Session

from core.config import settings
from core.logger import logger
from repositories.learning_map_repo import LearningMapRepository
from services.ai_service import AIService
from services.feature_model_config_service import FeatureModelConfigService
from utils.file_parser import parse_file


MAP_MODE_HINTS = {
    "syllabus": "按课程知识树组织内容，强调章节层级、主干结构与先修关系。",
    "document": "按上传材料抽取概念关系图，强调概念之间的包含、组成、先修与关联关系。",
}

LEARNING_MAP_PROMPT = """
你是一位教育知识工程专家。请基于输入材料生成学习地图，并且只输出合法 JSON。
地图模式：{map_mode}
模式说明：{mode_hint}

输出结构必须严格满足：
{{
  "nodes": [
    {{
      "title": "知识点名称",
      "description": "简短说明",
      "level": "foundation|intermediate|advanced",
      "mastery": "beginner|familiar|proficient",
      "example": "例题或场景",
      "resources": [{{"title": "资源名称", "url": "https://example.com"}}],
      "node_type": "topic|chapter|concept|skill|example",
      "primary_parent": "父节点标题或 null",
      "source_excerpt": "来自原文的证据摘要",
      "source_ref": "页码/段落/来源标识",
      "confidence": 0.0
    }}
  ],
  "edges": [
    {{
      "from": "起点标题",
      "to": "终点标题",
      "relation_type": "contains|part_of|prerequisite|related",
      "confidence": 0.0
    }}
  ]
}}

约束：
1. 至少 8 个节点、2 条边。
2. syllabus 模式优先补全章节层级和先修链路。
3. document 模式优先抽取材料中真实出现的概念关系，并尽量填写 source_excerpt/source_ref。
4. JSON 之外不得输出任何解释。
5. mastery 字段必须从 beginner/familiar/proficient 三个值中选择，禁止使用 unknown：
   - foundation 级别知识点：初次接触内容，默认填 beginner
   - intermediate 级别知识点：有一定基础，默认填 familiar
   - advanced 级别知识点：高阶内容，默认填 familiar（或 proficient 当内容显示已深入掌握）
   - 无论是否有学习历史，都必须根据内容难度和深度作出合理评估，不得使用 unknown

学习内容：
{content}
"""

PRIMARY_RELATION_PRIORITY = {
    "contains": 0,
    "part_of": 1,
    "prerequisite": 2,
    "related": 3,
}

PRIMARY_TREE_RELATIONS = {"contains", "part_of", "prerequisite"}


class LearningMapService:
    """封装学习地图相关业务逻辑"""

    UPLOAD_DIR = Path("uploads") / "learning_map"
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    @staticmethod
    async def upload_file(
        db: Session, user_id: int, file: UploadFile
    ) -> Dict[str, str]:
        file_ext = Path(file.filename).suffix.lower()
        target_path = LearningMapService.UPLOAD_DIR / f"{user_id}_{file.filename}"
        if target_path.exists():
            target_path = LearningMapService.UPLOAD_DIR / (
                f"{user_id}_{Path(file.filename).stem}_{target_path.stat().st_mtime_ns}{file_ext}"
            )

        content = await file.read()
        with open(target_path, "wb") as file_handle:
            file_handle.write(content)

        text, _ = parse_file(str(target_path))
        record = LearningMapRepository.create_file(
            db,
            user_id=user_id,
            file_path=str(target_path),
            raw_text=text,
            original_name=file.filename,
        )
        preview = text[:180] + ("..." if len(text) > 180 else "")
        return {
            "file_id": record.id,
            "file_name": record.original_name,
            "text_preview": preview,
            "message": "文件上传并解析成功",
        }

    @staticmethod
    def _clean_ai_text(text: str) -> str:
        cleaned = (text or "").strip()
        if cleaned.startswith("```"):
            cleaned = cleaned[3:].lstrip()
            if cleaned.lower().startswith("json"):
                cleaned = cleaned[4:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        return cleaned.strip()

    @staticmethod
    def _extract_json(text: str) -> Dict:
        cleaned = LearningMapService._clean_ai_text(text)
        try:
            start = cleaned.find("{")
            end = cleaned.rfind("}")
            if start == -1 or end == -1:
                raise ValueError("未找到完整的 JSON 结构")
            return json.loads(cleaned[start : end + 1])
        except Exception as exc:
            try:
                literal_value = ast.literal_eval(cleaned)
                if isinstance(literal_value, dict):
                    return literal_value
            except Exception:
                pass
            logger.error("解析学习地图 JSON 失败: %s; 原始内容: %s", exc, text)
            raise ValueError("AI 未返回合法的 JSON")

    @staticmethod
    def _build_retry_prompt(
        content_excerpt: str, map_mode: str, last_output: str
    ) -> str:
        return LEARNING_MAP_PROMPT.format(
            content=content_excerpt,
            map_mode=map_mode,
            mode_hint=MAP_MODE_HINTS.get(map_mode, MAP_MODE_HINTS["document"]),
        ) + f"\n\n上一次输出不合法，请重新生成。错误示例：\n{last_output[:600]}"

    @staticmethod
    def _invoke_ai_with_retry(
        db: Session,
        source_excerpt: str,
        map_mode: str,
        provider: Optional[str],
        max_attempts: int = 2,
    ) -> Dict:
        prompt = LEARNING_MAP_PROMPT.format(
            content=source_excerpt,
            map_mode=map_mode,
            mode_hint=MAP_MODE_HINTS.get(map_mode, MAP_MODE_HINTS["document"]),
        )
        last_error: Optional[Exception] = None

        for attempt in range(1, max_attempts + 1):
            ai_result = AIService.call_ai(
                db=db,
                user_prompt=prompt,
                system_prompt_name="learning_map_system",
                provider=provider,
                temperature=0.4,
                max_tokens=settings.AI_DEFAULT_MAX_TOKENS,
                quality_context={
                    "task": "learning_map_generation",
                    "map_mode": map_mode,
                },
            )
            raw_text = ai_result.get("raw", "") or ai_result.get("text", "")
            try:
                return LearningMapService._extract_json(raw_text)
            except ValueError as exc:
                last_error = exc
                if attempt < max_attempts:
                    # Feed the invalid output back into the retry prompt so the
                    # model can correct structure errors instead of regenerating blindly.
                    prompt = LearningMapService._build_retry_prompt(
                        source_excerpt, map_mode, raw_text
                    )

        if last_error:
            raise last_error
        raise ValueError("AI 未返回合法的 JSON")

    @staticmethod
    def _normalize_node(node: Dict) -> Dict:
        resources = node.get("resources", [])
        return {
            "title": (node.get("title") or "未命名知识点")[:255],
            "description": (node.get("description") or "")[:1000],
            "level": (node.get("level") or "intermediate")[:64],
            "mastery": (node.get("mastery") or "beginner")[:32],
            "example": (node.get("example") or "")[:1000],
            "resources": json.dumps(resources, ensure_ascii=False),
            "node_type": (node.get("node_type") or "concept")[:64],
            "primary_parent": (
                (node.get("primary_parent") or None)[:255]
                if node.get("primary_parent")
                else None
            ),
            "source_excerpt": (node.get("source_excerpt") or "")[:1000],
            "source_ref": (node.get("source_ref") or "")[:255],
            "confidence": (
                float(node.get("confidence"))
                if node.get("confidence") is not None
                else None
            ),
        }

    @staticmethod
    def _normalize_edge(edge: Dict) -> Dict:
        relation_type = edge.get("relation_type") or edge.get("relation") or "related"
        return {
            "from": edge.get("from") or edge.get("source"),
            "to": edge.get("to") or edge.get("target"),
            "relation": relation_type,
            "relation_type": relation_type,
            "confidence": (
                float(edge.get("confidence"))
                if edge.get("confidence") is not None
                else None
            ),
        }

    @staticmethod
    def generate_graph(
        db: Session,
        user_id: int,
        file_id: Optional[int],
        course_topic: Optional[str],
        provider: Optional[str],
        map_mode: str = "document",
    ) -> Dict[str, int]:
        if not file_id and not course_topic:
            raise ValueError("请提供 file_id 或 course_topic")

        if provider is None:
            provider = FeatureModelConfigService.get_provider_for_feature(db, "learning_map")

        map_mode = map_mode if map_mode in MAP_MODE_HINTS else "document"
        source_text = ""
        file_record = None
        if file_id:
            file_record = LearningMapRepository.get_file(db, file_id, user_id)
            if not file_record:
                raise ValueError("找不到指定的学习资料")
            source_text = file_record.raw_text or ""
        if course_topic:
            source_text = f"课程主题：{course_topic}\n{source_text}".strip()

        content_excerpt = source_text[:10000]
        payload = LearningMapService._invoke_ai_with_retry(
            db=db,
            source_excerpt=content_excerpt,
            map_mode=map_mode,
            provider=provider,
        )

        nodes_data = payload.get("nodes", [])
        edges_data = payload.get("edges", [])
        if not nodes_data:
            raise ValueError("AI 未生成任何知识点，请提供更详细的资料")

        normalized_nodes = [
            LearningMapService._normalize_node(node) for node in nodes_data
        ]
        normalized_edges = [
            LearningMapService._normalize_edge(edge) for edge in edges_data
        ]

        session_record = LearningMapRepository.create_session(
            db=db,
            user_id=user_id,
            topic=course_topic or (file_record.original_name if file_record else None),
            provider=provider,
            file_id=file_id,
            source_preview=content_excerpt[:200],
            map_mode=map_mode,
        )
        nodes = LearningMapRepository.create_nodes(
            db=db,
            user_id=user_id,
            session_id=session_record.id,
            nodes_data=normalized_nodes,
            file_id=file_id,
        )
        # Persist nodes first and resolve edges by title after ids are assigned.
        title_to_id = {node.title: node.id for node in nodes}
        edges = LearningMapRepository.create_edges(
            db=db,
            user_id=user_id,
            session_id=session_record.id,
            edges_payload=normalized_edges,
            title_to_id=title_to_id,
        )

        return {
            "success": True,
            "node_count": len(nodes),
            "edge_count": len(edges),
            "session_id": session_record.id,
            "map_mode": map_mode,
            "message": "知识图谱生成完成",
        }

    @staticmethod
    def _serialize_graph(nodes: List, edges: List) -> Dict[str, List[Dict]]:
        serialized_nodes = []
        for node in nodes:
            try:
                resources_list = json.loads(node.resources) if node.resources else []
            except json.JSONDecodeError:
                resources_list = []
            serialized_nodes.append(
                {
                    "id": node.id,
                    "title": node.title,
                    "description": node.description,
                    "level": node.level,
                    "mastery": node.mastery,
                    "example": node.example,
                    "resources": resources_list,
                    "node_type": node.node_type,
                    "primary_parent": node.primary_parent,
                    "source_excerpt": node.source_excerpt,
                    "source_ref": node.source_ref,
                    "confidence": node.confidence,
                }
            )

        serialized_edges = []
        for edge in edges:
            serialized_edges.append(
                {
                    "id": edge.id,
                    "from_node_id": edge.from_node_id,
                    "to_node_id": edge.to_node_id,
                    "relation": edge.relation_type or edge.relation,
                    "relation_type": edge.relation_type or edge.relation,
                    "confidence": edge.confidence,
                }
            )
        return {"nodes": serialized_nodes, "edges": serialized_edges}

    @staticmethod
    def get_graph(
        db: Session, user_id: int, session_id: Optional[int] = None
    ) -> Dict[str, List[Dict]]:
        session_record = None
        if session_id:
            session_record = LearningMapRepository.get_session(
                db, user_id=user_id, session_id=session_id
            )
        if not session_record:
            session_record = LearningMapRepository.get_latest_session(db, user_id)
        if not session_record:
            return {"session": None, "nodes": [], "edges": []}

        nodes, edges = LearningMapRepository.get_graph_by_session(
            db, user_id, session_record
        )
        graph = LearningMapService._serialize_graph(nodes, edges)
        graph["session"] = {
            "id": session_record.id,
            "topic": session_record.topic,
            "provider": session_record.provider,
            "file_id": session_record.file_id,
            "map_mode": session_record.map_mode,
            "source_preview": session_record.source_preview,
            "created_at": session_record.created_at,
        }
        return graph

    @staticmethod
    def get_history(db: Session, user_id: int, limit: int = 20):
        sessions = LearningMapRepository.list_sessions(db, user_id, limit=limit)
        history = []
        for session_obj in sessions:
            history.append(
                {
                    "id": session_obj.id,
                    "topic": session_obj.topic,
                    "provider": session_obj.provider,
                    "file_id": session_obj.file_id,
                    "map_mode": session_obj.map_mode,
                    "created_at": session_obj.created_at,
                    "source_preview": session_obj.source_preview,
                }
            )
        return history

    @staticmethod
    def export_learning_map(
        db: Session,
        user_id: int,
        session_id: int,
        export_format: str = "xmind",
    ) -> Dict[str, bytes]:
        session_record = LearningMapRepository.get_session(db, user_id, session_id)
        if not session_record:
            raise ValueError("知识图谱会话不存在")
        if export_format != "xmind":
            raise ValueError("当前仅支持导出 xmind")

        nodes, edges = LearningMapRepository.get_graph_by_session(
            db, user_id, session_record
        )
        graph = LearningMapService._serialize_graph(nodes, edges)
        content = LearningMapService._build_xmind_archive(
            session_record.topic or "学习地图",
            session_record.map_mode,
            graph,
        )
        return {
            "filename": f"learning-map-{session_record.id}.xmind",
            "content": content,
        }

    @staticmethod
    def _select_primary_parents(
        root_title: str, graph: Dict[str, List[Dict]], map_mode: str
    ) -> Tuple[Dict[str, str], Dict[str, List[str]]]:
        nodes = graph["nodes"]
        edges = graph["edges"]
        titles = {node["id"]: node["title"] for node in nodes}
        primary_parents: Dict[str, str] = {}
        secondary_relations: Dict[str, List[str]] = {}

        if map_mode == "syllabus":
            for node in nodes:
                if node["primary_parent"]:
                    primary_parents[node["title"]] = node["primary_parent"]
            return primary_parents, secondary_relations

        inbound_by_target: Dict[str, List[Dict[str, str]]] = {}
        edge_records: List[Dict[str, str]] = []
        for edge in edges:
            source_title = titles.get(edge["from_node_id"])
            target_title = titles.get(edge["to_node_id"])
            if not source_title or not target_title:
                continue
            edge_record = {
                "from": source_title,
                "to": target_title,
                "relation_type": edge.get("relation_type")
                or edge.get("relation")
                or "related",
            }
            inbound_by_target.setdefault(target_title, []).append(edge_record)
            edge_records.append(edge_record)

        primary_edge_keys = set()
        for node in nodes:
            target_title = node["title"]
            inbound = inbound_by_target.get(target_title, [])
            preferred_edges = [
                item
                for item in inbound
                if item["relation_type"] in PRIMARY_TREE_RELATIONS
            ]
            if preferred_edges:
                preferred_edges.sort(
                    key=lambda item: PRIMARY_RELATION_PRIORITY.get(
                        item["relation_type"], 99
                    )
                )
                primary = preferred_edges[0]
                if primary["from"] != target_title:
                    primary_parents[target_title] = primary["from"]
                    primary_edge_keys.add(
                        (primary["from"], primary["to"], primary["relation_type"])
                    )
            elif node.get("primary_parent"):
                primary_parents[target_title] = node["primary_parent"]

        if root_title in primary_parents:
            primary_parents.pop(root_title, None)

        for edge_record in edge_records:
            edge_key = (
                edge_record["from"],
                edge_record["to"],
                edge_record["relation_type"],
            )
            if edge_key in primary_edge_keys:
                continue
            secondary_relations.setdefault(edge_record["from"], []).append(
                f"关联关系：{edge_record['from']} -> {edge_record['to']} ({edge_record['relation_type']})"
            )

        return primary_parents, secondary_relations

    @staticmethod
    def _build_topic_note(node: Dict, extra_relations: List[str]) -> str:
        lines = []
        if node.get("description"):
            lines.append(f"说明：{node['description']}")
        if node.get("example"):
            lines.append(f"示例：{node['example']}")
        if node.get("source_excerpt"):
            lines.append(f"证据摘要：{node['source_excerpt']}")
        if node.get("source_ref"):
            lines.append(f"来源：{node['source_ref']}")
        if node.get("confidence") is not None:
            lines.append(f"置信度：{node['confidence']}")
        resources = node.get("resources") or []
        if resources:
            lines.append("资源：")
            for item in resources:
                title = item.get("title") or "资源"
                url = item.get("url") or ""
                lines.append(f"- {title}: {url}")
        lines.extend(extra_relations)
        return "\n".join(lines).strip()

    @staticmethod
    def _build_xmind_archive(
        root_title: str, map_mode: str, graph: Dict[str, List[Dict]]
    ) -> bytes:
        nodes = graph["nodes"]
        primary_parents, secondary_relations = LearningMapService._select_primary_parents(
            root_title, graph, map_mode
        )

        node_by_title = {node["title"]: node for node in nodes}
        children: Dict[str, List[str]] = {}
        for child_title, parent_title in primary_parents.items():
            if parent_title:
                children.setdefault(parent_title, []).append(child_title)

        def build_topic(title: str) -> Dict:
            node = node_by_title.get(
                title,
                {
                    "title": title,
                    "description": "",
                    "example": "",
                    "resources": [],
                    "source_excerpt": "",
                    "source_ref": "",
                    "confidence": None,
                },
            )
            topic = {
                "id": str(uuid4()),
                "class": "topic",
                "title": title,
            }
            note_content = LearningMapService._build_topic_note(
                node, secondary_relations.get(title, [])
            )
            if note_content:
                topic["notes"] = {"plain": {"content": note_content}}
            attached_children = [
                build_topic(child)
                for child in children.get(title, [])
                if child != title
            ]
            if attached_children:
                topic["children"] = {"attached": attached_children}
            return topic

        top_level_titles = [
            node["title"]
            for node in nodes
            if node["title"] not in primary_parents
            and node["title"] != root_title
            and node["title"] not in children.get(root_title, [])
        ]

        root_topic = {
            "id": str(uuid4()),
            "class": "topic",
            "title": root_title,
        }
        if root_title in node_by_title:
            root_note = LearningMapService._build_topic_note(
                node_by_title[root_title],
                secondary_relations.get(root_title, []),
            )
            if root_note:
                root_topic["notes"] = {"plain": {"content": root_note}}
        root_child_titles = list(children.get(root_title, [])) + top_level_titles
        root_children = [build_topic(title) for title in root_child_titles]
        if root_children:
            root_topic["children"] = {"attached": root_children}

        content = [
            {
                "id": str(uuid4()),
                "class": "sheet",
                "title": root_title,
                "rootTopic": root_topic,
            }
        ]
        metadata = {
            "creator": {"name": "智学伴"},
            "activeSheetId": content[0]["id"],
        }
        manifest = {
            "file-entries": {
                "content.json": {},
                "metadata.json": {},
                "manifest.json": {},
            }
        }

        buffer = BytesIO()
        with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as zip_file:
            zip_file.writestr("content.json", json.dumps(content, ensure_ascii=False))
            zip_file.writestr("metadata.json", json.dumps(metadata, ensure_ascii=False))
            zip_file.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False))
        return buffer.getvalue()
