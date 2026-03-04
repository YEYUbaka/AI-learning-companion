"""
学习地图服务
作者：智学伴开发团队
"""
import ast
import json
from pathlib import Path
from typing import Dict, List, Optional
from fastapi import UploadFile
from sqlalchemy.orm import Session
from utils.file_parser import parse_file
from repositories.learning_map_repo import LearningMapRepository
from services.ai_service import AIService
from core.logger import logger


LEARNING_MAP_PROMPT = """
你是一位知识图谱工程专家。请根据提供的课程内容或主题，构建学习知识图谱，并**只用一个 JSON 代码块**输出（不能出现解释性的自然语言，也不能在 JSON 之外追加提示或总结）。输出前请自检能否被 `JSON.parse()` 成功解析。

必须严格遵循（字段不可缺失、不可改名）：
```json
{{
  "nodes": [
    {{
      "title": "唯一知识点名称",
      "description": "字数在50~80之间的解释",
      "level": "foundation|intermediate|advanced",
      "mastery": "strong|medium|weak",
      "example": "典型例题或场景",
      "resources": ["推荐资源1", "推荐资源2"]
    }}
  ],
  "edges": [
    {{"from": "基础概念", "to": "进阶概念", "relation": "先修/依赖/包含"}}
  ]
}}
```

额外要求：
1. 至少生成 6 个节点与 8 条边。
2. `resources` 必须是字符串数组（即使只有 1 条也使用数组形式）。
3. 不得输出 JSON 之外的任何文字（包括问候、注释、Markdown 标题、再次解释等）。
4. 输出缺失字段或存在语法错误时必须立即重新生成，直到 JSON 合法。

学习内容：
{content}
"""


class LearningMapService:
    """封装知识图谱业务逻辑"""

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
        with open(target_path, "wb") as f:
            f.write(content)

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
        """移除围栏和多余说明"""
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
            cleaned = cleaned.lstrip()
            if cleaned.lower().startswith("json"):
                cleaned = cleaned[4:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        return cleaned.strip()

    @staticmethod
    def _extract_json(text: str) -> Dict:
        """从AI返回中提取JSON"""
        cleaned = LearningMapService._clean_ai_text(text)
        try:
            start = cleaned.find("{")
            end = cleaned.rfind("}")
            if start == -1 or end == -1:
                raise ValueError("未找到完整的 JSON 结构")
            json_str = cleaned[start : end + 1]
            return json.loads(json_str)
        except Exception as exc:
            # 再尝试一次 python literal 解析，兼容单引号等情况
            try:
                literal_value = ast.literal_eval(cleaned)
                if isinstance(literal_value, dict):
                    return literal_value
            except Exception:
                pass
            logger.error("解析知识图谱JSON失败: %s; 原始内容: %s", exc, text)
            raise ValueError("AI未返回合法的JSON，请提供更详细的资料或稍后重试")

    @staticmethod
    def _build_retry_prompt(content_excerpt: str, last_output: str) -> str:
        """当AI输出不合法时，构造强化提示"""
        trimmed_last = last_output[:800]
        return f"""
你刚才的回答不是合法 JSON。请立即重新生成，并只输出一个 ```json``` 代码块，确保能够被 JSON.parse() 正确解析。
请严格遵守之前的字段及要求，不得插入任何额外说明。

学习内容（截断）:
{content_excerpt}

你上一次的输出（供参考，请勿原样复制）:
{trimmed_last}
"""

    @staticmethod
    def _invoke_ai_with_retry(
        db: Session,
        base_prompt: str,
        source_excerpt: str,
        provider: Optional[str],
        max_attempts: int = 2,
    ) -> Dict:
        """调用AI生成结构化内容，失败时自动重试"""
        attempt_prompt = base_prompt
        last_error: Optional[Exception] = None
        for attempt in range(1, max_attempts + 1):
            ai_result = AIService.call_ai(
                db,
                user_prompt=attempt_prompt,
                system_prompt_name="learning_map_system",
                provider=provider,
                temperature=0.7,
                max_tokens=4000  # 增加token数量，知识图谱需要更多内容
            )
            ai_text = ai_result.get("text", "")
            try:
                return LearningMapService._extract_json(ai_text)
            except ValueError as exc:
                last_error = exc
                logger.warning(
                    "AI输出非JSON (attempt %s/%s): %s",
                    attempt,
                    max_attempts,
                    ai_text[:500],
                )
                if attempt < max_attempts:
                    attempt_prompt = LearningMapService._build_retry_prompt(
                        source_excerpt, ai_text
                    )
        if last_error:
            raise last_error
        raise ValueError("AI未返回合法的JSON，请提供更详细的资料或稍后重试")

    @staticmethod
    def generate_graph(
        db: Session,
        user_id: int,
        file_id: Optional[int],
        course_topic: Optional[str],
        provider: Optional[str],
    ) -> Dict[str, int]:
        if not file_id and not course_topic:
            raise ValueError("请提供文件ID或课程主题")

        source_text = ""
        file_record = None
        if file_id:
            file_record = LearningMapRepository.get_file(db, file_id, user_id)
            if not file_record:
                raise ValueError("找不到指定的学习资料")
            source_text = file_record.raw_text or ""
        if course_topic:
            source_text = f"课程主题：{course_topic}\n" + source_text

        content_excerpt = source_text[:4000]
        prompt = LEARNING_MAP_PROMPT.format(content=content_excerpt)
        payload = LearningMapService._invoke_ai_with_retry(
            db,
            base_prompt=prompt,
            source_excerpt=content_excerpt,
            provider=provider,
        )

        nodes_data = payload.get("nodes", [])
        edges_data = payload.get("edges", [])

        if not nodes_data:
            raise ValueError("AI未生成任何知识点，请提供更详细的资料")

        normalized_nodes: List[Dict] = []
        for node in nodes_data:
            normalized_nodes.append(
                {
                    "title": node.get("title", "未命名知识点")[:255],
                    "description": node.get("description", "")[:1000],
                    "level": node.get("level", "intermediate"),
                    "mastery": node.get("mastery", "medium"),
                    "example": node.get("example", "")[:1000],
                    "resources": json.dumps(
                        node.get("resources", []), ensure_ascii=False
                    ),
                }
            )

        session_record = LearningMapRepository.create_session(
            db,
            user_id=user_id,
            topic=course_topic or (file_record.original_name if file_id else None),
            provider=provider,
            file_id=file_id,
            source_preview=content_excerpt[:200],
        )

        nodes = LearningMapRepository.create_nodes(
            db,
            user_id=user_id,
            session_id=session_record.id,
            nodes_data=normalized_nodes,
            file_id=file_id,
        )
        title_to_id = {node.title: node.id for node in nodes}

        normalized_edges = []
        for edge in edges_data:
            normalized_edges.append(
                {
                    "from": edge.get("from") or edge.get("source"),
                    "to": edge.get("to") or edge.get("target"),
                    "relation": edge.get("relation", "depends_on"),
                }
            )

        LearningMapRepository.create_edges(
            db,
            user_id=user_id,
            session_id=session_record.id,
            edges_payload=normalized_edges,
            title_to_id=title_to_id,
        )

        return {
            "success": True,
            "node_count": len(nodes),
            "edge_count": len(normalized_edges),
            "session_id": session_record.id,
            "message": "知识图谱生成完成",
        }

    @staticmethod
    def _serialize_graph(nodes: List, edges: List) -> Dict[str, List[Dict]]:
        serialized_nodes = []
        for node in nodes:
            resources = node.resources
            try:
                resources_list = json.loads(resources) if resources else []
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
                }
            )
        serialized_edges = [
            {
                "id": edge.id,
                "from_node_id": edge.from_node_id,
                "to_node_id": edge.to_node_id,
                "relation": edge.relation,
            }
            for edge in edges
        ]
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
                    "created_at": session_obj.created_at,
                    "source_preview": session_obj.source_preview,
                }
            )
        return history

