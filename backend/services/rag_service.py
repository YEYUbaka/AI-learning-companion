"""
RAG 服务 - 基于 ChromaDB 的语义检索核心
"""
import os
import json
import uuid
from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from datetime import datetime
from sqlalchemy.orm import Session

from core.logger import logger
from core.config import settings


@dataclass
class SearchResult:
    """检索结果"""
    text: str
    title: str
    grade_level: Optional[str]
    subject: Optional[str]
    topic: Optional[str]
    difficulty: Optional[str]
    source: Optional[str]
    section_title: Optional[str]
    image_paths: List[str]
    distance: float


class RAGService:
    """RAG 检索服务（ChromaDB + SentenceTransformers）"""

    COLLECTION_NAME = "zhixueban_knowledge"
    _client = None
    _collection = None
    _embedding_fn = None

    @classmethod
    def _get_embedding_fn(cls):
        """懒加载嵌入函数（优先 SentenceTransformer，失败时用 ChromaDB 内置 ONNX 函数）"""
        if cls._embedding_fn is None:
            # 设置国内镜像，加速模型下载
            os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")
            os.environ.setdefault("HUGGINGFACE_HUB_VERBOSITY", "warning")

            try:
                from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
                cls._embedding_fn = SentenceTransformerEmbeddingFunction(
                    model_name="paraphrase-multilingual-MiniLM-L12-v2"
                )
                logger.info("SentenceTransformer 嵌入模型加载成功（多语言）")
            except Exception as e:
                logger.warning(f"SentenceTransformer 加载失败，尝试 ChromaDB 内置嵌入函数: {e}")
                try:
                    from chromadb.utils.embedding_functions import DefaultEmbeddingFunction
                    cls._embedding_fn = DefaultEmbeddingFunction()
                    logger.info("ChromaDB DefaultEmbeddingFunction（ONNX）加载成功")
                except Exception as e2:
                    logger.warning(f"ChromaDB 内置嵌入函数也不可用，RAG 将使用关键词模式: {e2}")
                    cls._embedding_fn = None
        return cls._embedding_fn

    @classmethod
    def get_collection(cls):
        """获取或创建 ChromaDB Collection（懒加载）"""
        if cls._collection is not None:
            return cls._collection

        try:
            import chromadb

            # 确保 ChromaDB 目录存在
            chroma_dir = os.path.abspath(settings.CHROMA_DB_DIR)
            os.makedirs(chroma_dir, exist_ok=True)

            cls._client = chromadb.PersistentClient(path=chroma_dir)

            # 获取嵌入函数
            embedding_fn = cls._get_embedding_fn()

            kwargs = {"name": cls.COLLECTION_NAME}
            if embedding_fn is not None:
                kwargs["embedding_function"] = embedding_fn

            cls._collection = cls._client.get_or_create_collection(**kwargs)
            logger.info(f"ChromaDB Collection '{cls.COLLECTION_NAME}' 初始化成功")
            return cls._collection

        except ImportError:
            logger.warning("chromadb 未安装，RAG 功能不可用。请运行: pip install chromadb>=0.5.0")
            return None
        except Exception as e:
            logger.error(f"ChromaDB 初始化失败: {e}")
            return None

    @classmethod
    def index_document(cls, db: Session, doc_id: int) -> Dict[str, Any]:
        """
        索引指定文档

        Args:
            db: 数据库会话
            doc_id: KnowledgeDocument.id

        Returns:
            {"success": bool, "chunk_count": int, "error": str}
        """
        from models.knowledge import KnowledgeDocument, KnowledgeChunk
        from utils.knowledge_parser import parse_knowledge_file, copy_images_to_pool

        collection = cls.get_collection()
        if collection is None:
            return {"success": False, "error": "ChromaDB 不可用"}

        doc = db.query(KnowledgeDocument).filter(KnowledgeDocument.id == doc_id).first()
        if not doc:
            return {"success": False, "error": f"文档不存在: {doc_id}"}

        try:
            # 更新状态
            doc.status = "indexing"
            db.commit()

            # 解析文档
            parsed = parse_knowledge_file(doc.file_path)

            # 复制图片到全局图片池
            image_pool_dir = os.path.abspath(os.path.join(settings.KNOWLEDGE_BASE_DIR, "images"))
            img_map = copy_images_to_pool(doc.file_path, image_pool_dir)

            # 先删除旧的 chunks（如果重建索引）
            existing_chunk_ids = [c.chroma_id for c in doc.chunks]
            if existing_chunk_ids:
                try:
                    collection.delete(ids=existing_chunk_ids)
                except Exception:
                    pass
            db.query(KnowledgeChunk).filter(KnowledgeChunk.document_id == doc_id).delete()
            db.commit()

            # 批量添加到 ChromaDB
            documents_texts = []
            metadatas = []
            chroma_ids = []
            chunk_records = []

            for chunk in parsed.chunks:
                if not chunk.text.strip():
                    continue

                chroma_id = f"doc{doc_id}_chunk{chunk.chunk_index}_{uuid.uuid4().hex[:8]}"

                # 将图片路径转换为相对于 /knowledge_images/ 的路径
                mapped_images = []
                for abs_path in chunk.image_paths:
                    # 找到在 img_map 中对应的新路径
                    for orig, new_name in img_map.items():
                        orig_abs = os.path.normpath(os.path.join(os.path.dirname(doc.file_path), orig))
                        if os.path.normpath(abs_path) == orig_abs:
                            mapped_images.append(new_name)
                            break

                documents_texts.append(chunk.text)
                metadatas.append({
                    "document_id": str(doc_id),
                    "title": parsed.title,
                    "grade_level": parsed.grade_level or "",
                    "subject": parsed.subject or "",
                    "topic": parsed.topic or "",
                    "difficulty": parsed.difficulty or "",
                    "source": parsed.source or "",
                    "section_title": chunk.section_title or "",
                    "chunk_index": str(chunk.chunk_index),
                    "image_paths": json.dumps(mapped_images, ensure_ascii=False),
                    "tags": json.dumps(parsed.tags, ensure_ascii=False),
                })
                chroma_ids.append(chroma_id)

                chunk_records.append(KnowledgeChunk(
                    document_id=doc_id,
                    chroma_id=chroma_id,
                    chunk_index=chunk.chunk_index,
                    section_title=chunk.section_title,
                    content_preview=chunk.text[:200],
                    image_paths=mapped_images,
                    char_count=len(chunk.text)
                ))

            if documents_texts:
                # 分批添加（ChromaDB 单次有上限）
                batch_size = 100
                for i in range(0, len(documents_texts), batch_size):
                    collection.add(
                        documents=documents_texts[i:i + batch_size],
                        metadatas=metadatas[i:i + batch_size],
                        ids=chroma_ids[i:i + batch_size]
                    )

            # 保存到 SQLite
            for record in chunk_records:
                db.add(record)

            doc.chunk_count = len(chunk_records)
            doc.status = "indexed"
            doc.indexed_at = datetime.utcnow()
            doc.title = parsed.title
            doc.grade_level = parsed.grade_level
            doc.subject = parsed.subject
            doc.topic = parsed.topic
            doc.difficulty = parsed.difficulty
            doc.source = parsed.source
            doc.tags = parsed.tags
            db.commit()

            logger.info(f"文档 {doc_id} 索引完成，共 {len(chunk_records)} 个分块")
            return {"success": True, "chunk_count": len(chunk_records)}

        except Exception as e:
            logger.error(f"文档索引失败: {e}", exc_info=True)
            doc.status = "failed"
            doc.error_message = str(e)
            db.commit()
            return {"success": False, "error": str(e)}

    # AI-assisted: ChatGPT-4o 2026-02 — ChromaDB语义检索查询构造与SentenceTransformer懒加载
    # Prompt: "请帮我实现一个基于ChromaDB的RAG检索服务..."
    # 修改: HF_ENDPOINT国内镜像、image_paths字段、SearchResult字段定义、Agent工具集成由开发者实现
    @classmethod
    def search(
        cls,
        query: str,
        n_results: int = 5,
        grade_level: Optional[str] = None,
        subject: Optional[str] = None
    ) -> List[SearchResult]:
        """
        语义搜索

        Args:
            query: 搜索查询
            n_results: 返回结果数量
            grade_level: 年级过滤（小学/初中/高中/大学/通用）
            subject: 学科过滤

        Returns:
            List[SearchResult]
        """
        collection = cls.get_collection()
        if collection is None:
            return []

        try:
            # 构造过滤条件
            where = None
            filters = []
            if grade_level:
                filters.append({"grade_level": {"$eq": grade_level}})
            if subject:
                filters.append({"subject": {"$eq": subject}})

            if len(filters) == 1:
                where = filters[0]
            elif len(filters) > 1:
                where = {"$and": filters}

            # 查询
            kwargs = {
                "query_texts": [query],
                "n_results": min(n_results, max(1, collection.count()))
            }
            if where:
                kwargs["where"] = where

            results = collection.query(**kwargs)

            search_results = []
            if not results["documents"] or not results["documents"][0]:
                return []

            for i, (doc_text, metadata, distance) in enumerate(zip(
                results["documents"][0],
                results["metadatas"][0],
                results["distances"][0]
            )):
                image_paths = []
                try:
                    image_paths = json.loads(metadata.get("image_paths", "[]"))
                except Exception:
                    pass

                search_results.append(SearchResult(
                    text=doc_text,
                    title=metadata.get("title", ""),
                    grade_level=metadata.get("grade_level") or None,
                    subject=metadata.get("subject") or None,
                    topic=metadata.get("topic") or None,
                    difficulty=metadata.get("difficulty") or None,
                    source=metadata.get("source") or None,
                    section_title=metadata.get("section_title") or None,
                    image_paths=image_paths,
                    distance=distance
                ))

            return search_results

        except Exception as e:
            logger.error(f"RAG 搜索失败: {e}", exc_info=True)
            return []

    @classmethod
    def build_rag_context(cls, query: str, results: List[SearchResult], max_chars: int = 3000) -> str:
        """将检索结果构建为 LLM 可读的 context"""
        if not results:
            return ""

        lines = ["[知识库参考资料]"]
        total_chars = 0

        for result in results:
            if total_chars >= max_chars:
                break

            lines.append("---")
            source_info = result.title
            if result.grade_level or result.subject:
                source_info += f"（{result.grade_level or ''} {result.subject or ''}）".strip()
            lines.append(f"来源：{source_info}")

            if result.section_title:
                lines.append(f"章节：{result.section_title}")

            text = result.text
            remaining = max_chars - total_chars
            if len(text) > remaining:
                text = text[:remaining] + "..."

            lines.append(text)
            total_chars += len(text)

            for img_path in result.image_paths:
                lines.append(f"[图片参考: /knowledge_images/{img_path}]")

        lines.append("---")
        return "\n".join(lines)

    @classmethod
    def delete_document(cls, db: Session, doc_id: int) -> bool:
        """删除文档及其所有 chunks"""
        from models.knowledge import KnowledgeDocument, KnowledgeChunk

        doc = db.query(KnowledgeDocument).filter(KnowledgeDocument.id == doc_id).first()
        if not doc:
            return False

        try:
            collection = cls.get_collection()
            if collection:
                chunk_ids = [c.chroma_id for c in doc.chunks]
                if chunk_ids:
                    collection.delete(ids=chunk_ids)

            db.query(KnowledgeChunk).filter(KnowledgeChunk.document_id == doc_id).delete()
            db.delete(doc)
            db.commit()
            return True
        except Exception as e:
            logger.error(f"删除文档失败: {e}")
            db.rollback()
            return False

    @classmethod
    def get_stats(cls, db: Session) -> Dict[str, Any]:
        """获取知识库统计信息"""
        from models.knowledge import KnowledgeDocument

        total = db.query(KnowledgeDocument).count()
        indexed = db.query(KnowledgeDocument).filter(KnowledgeDocument.status == "indexed").count()
        failed = db.query(KnowledgeDocument).filter(KnowledgeDocument.status == "failed").count()
        pending = db.query(KnowledgeDocument).filter(KnowledgeDocument.status == "pending").count()

        collection = cls.get_collection()
        chroma_count = 0
        if collection:
            try:
                chroma_count = collection.count()
            except Exception:
                pass

        return {
            "total_documents": total,
            "indexed": indexed,
            "failed": failed,
            "pending": pending,
            "total_chunks": chroma_count,
            "rag_available": collection is not None,
        }

    @classmethod
    def scan_and_index(cls, db: Session, corpus_dir: Optional[str] = None) -> Dict[str, Any]:
        """
        扫描 corpus 目录并批量索引所有 .md 文件

        Returns:
            {"added": int, "updated": int, "failed": int, "skipped": int}
        """
        from models.knowledge import KnowledgeDocument

        if corpus_dir is None:
            corpus_dir = os.path.abspath(os.path.join(settings.KNOWLEDGE_BASE_DIR, "corpus"))

        if not os.path.exists(corpus_dir):
            os.makedirs(corpus_dir, exist_ok=True)
            return {"added": 0, "updated": 0, "failed": 0, "skipped": 0}

        stats = {"added": 0, "updated": 0, "failed": 0, "skipped": 0}

        # 递归找所有 .md 文件
        for root, _, files in os.walk(corpus_dir):
            for filename in files:
                if not filename.endswith(".md"):
                    continue

                file_path = os.path.abspath(os.path.join(root, filename))

                # 查找或创建文档记录
                existing = db.query(KnowledgeDocument).filter(
                    KnowledgeDocument.file_path == file_path
                ).first()

                if existing:
                    # 重新索引
                    result = cls.index_document(db, existing.id)
                    if result["success"]:
                        stats["updated"] += 1
                    else:
                        stats["failed"] += 1
                else:
                    # 新增文档
                    doc = KnowledgeDocument(
                        title=os.path.splitext(filename)[0],
                        file_path=file_path,
                        status="pending"
                    )
                    db.add(doc)
                    db.commit()
                    db.refresh(doc)

                    result = cls.index_document(db, doc.id)
                    if result["success"]:
                        stats["added"] += 1
                    else:
                        stats["failed"] += 1

        return stats
