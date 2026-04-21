"""
知识库路由 - 提供知识库管理和搜索 API
"""
import os
import tempfile
import shutil
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from core.security import get_current_user, get_current_admin
from services.rag_service import RAGService
from models.knowledge import KnowledgeDocument
from core.logger import logger
from core.config import settings


router = APIRouter(prefix="/api/v1/knowledge", tags=["knowledge"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class DocumentCreate(BaseModel):
    file_path: str
    title: Optional[str] = None


class DocumentCreateOnline(BaseModel):
    """在线创建文档"""
    title: str
    grade_level: str
    subject: str
    topic: Optional[str] = None
    difficulty: Optional[str] = "easy"
    source: Optional[str] = None
    tags: Optional[List[str]] = None
    content: str  # 完整的 Markdown 内容（包含 frontmatter）


class SearchQuery(BaseModel):
    q: str
    limit: int = 5
    grade_level: Optional[str] = None
    subject: Optional[str] = None


# ─── 用户端 API ───────────────────────────────────────────────────────────────

@router.get("/search")
async def search_knowledge(
    q: str,
    limit: int = 5,
    grade_level: Optional[str] = None,
    subject: Optional[str] = None,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    语义搜索知识库

    - q: 搜索查询
    - limit: 返回结果数量（默认 5）
    - grade_level: 年级过滤（小学/初中/高中/大学/通用）
    - subject: 学科过滤（数学/物理/化学/语文/英语/...）
    """
    results = RAGService.search(
        query=q,
        n_results=limit,
        grade_level=grade_level,
        subject=subject
    )

    return {
        "query": q,
        "count": len(results),
        "results": [
            {
                "title": r.title,
                "grade_level": r.grade_level,
                "subject": r.subject,
                "topic": r.topic,
                "section_title": r.section_title,
                "text": r.text[:300],
                "image_paths": r.image_paths,
                "distance": r.distance
            }
            for r in results
        ]
    }


# ─── 管理端 API ───────────────────────────────────────────────────────────────

@router.get("/documents")
async def list_documents(
    current_admin=Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """获取文档列表（管理员）"""
    docs = db.query(KnowledgeDocument).order_by(KnowledgeDocument.created_at.desc()).all()
    return {
        "count": len(docs),
        "documents": [
            {
                "id": d.id,
                "title": d.title,
                "file_path": d.file_path,
                "grade_level": d.grade_level,
                "subject": d.subject,
                "topic": d.topic,
                "difficulty": d.difficulty,
                "source": d.source,
                "tags": d.tags,
                "chunk_count": d.chunk_count,
                "status": d.status,
                "error_message": d.error_message,
                "indexed_at": d.indexed_at.isoformat() if d.indexed_at else None,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in docs
        ]
    }


@router.post("/documents")
async def register_document(
    body: DocumentCreate,
    background_tasks: BackgroundTasks,
    current_admin=Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """注册并索引文档（管理员）"""
    file_path = os.path.abspath(body.file_path)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=400, detail=f"文件不存在: {file_path}")

    if not file_path.endswith(".md"):
        raise HTTPException(status_code=400, detail="目前仅支持 .md 格式的知识文件")

    # 检查是否已存在
    existing = db.query(KnowledgeDocument).filter(
        KnowledgeDocument.file_path == file_path
    ).first()

    if existing:
        # 重新索引
        doc_id = existing.id
    else:
        doc = KnowledgeDocument(
            title=body.title or os.path.splitext(os.path.basename(file_path))[0],
            file_path=file_path,
            status="pending"
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        doc_id = doc.id

    # 后台异步索引
    background_tasks.add_task(_index_document_task, doc_id)

    return {"success": True, "document_id": doc_id, "message": "文档已提交索引，后台处理中"}


@router.post("/documents/online")
async def create_document_online(
    body: DocumentCreateOnline,
    background_tasks: BackgroundTasks,
    current_admin=Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    在线创建文档（管理员）

    根据元数据自动生成文件路径并保存到 corpus 目录
    """
    # 构建文件路径：corpus/年级/学科/标题.md
    grade_dir = body.grade_level or "通用"
    subject_dir = body.subject or "其他"
    filename = body.title.replace("/", "-").replace("\\", "-").strip() + ".md"

    corpus_dir = os.path.abspath(os.path.join(settings.KNOWLEDGE_BASE_DIR, "corpus"))
    target_dir = os.path.join(corpus_dir, grade_dir, subject_dir)
    os.makedirs(target_dir, exist_ok=True)

    file_path = os.path.join(target_dir, filename)

    # 检查是否已存在同名文件
    if os.path.exists(file_path):
        # 添加时间戳后缀
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        filename = f"{body.title}_{timestamp}.md"
        file_path = os.path.join(target_dir, filename)

    # 写入文件
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(body.content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文件写入失败: {e}")

    # 创建数据库记录
    doc = KnowledgeDocument(
        title=body.title,
        file_path=file_path,
        grade_level=body.grade_level,
        subject=body.subject,
        topic=body.topic,
        difficulty=body.difficulty,
        source=body.source,
        tags=body.tags or [],
        status="pending"
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # 后台异步索引
    background_tasks.add_task(_index_document_task, doc.id)

    return {
        "success": True,
        "document_id": doc.id,
        "file_path": file_path,
        "message": "文档已创建并提交索引"
    }


@router.post("/documents/upload")
async def upload_documents(
    background_tasks: BackgroundTasks,
    current_admin=Depends(get_current_admin),
    db: Session = Depends(get_db),
    files: List[UploadFile] = File(...)
):
    """
    批量上传文档（管理员）

    支持 .md 文件批量上传，自动保存到 corpus/上传文件/ 目录
    """
    corpus_dir = os.path.abspath(os.path.join(settings.KNOWLEDGE_BASE_DIR, "corpus"))
    upload_dir = os.path.join(corpus_dir, "上传文件")
    os.makedirs(upload_dir, exist_ok=True)

    results = []
    doc_ids = []

    for file in files:
        if not file.filename.endswith(".md"):
            results.append({
                "filename": file.filename,
                "success": False,
                "error": "仅支持 .md 格式"
            })
            continue

        try:
            # 保存文件
            file_path = os.path.join(upload_dir, file.filename)
            content = await file.read()

            with open(file_path, "wb") as f:
                f.write(content)

            # 创建数据库记录
            doc = KnowledgeDocument(
                title=os.path.splitext(file.filename)[0],
                file_path=file_path,
                status="pending"
            )
            db.add(doc)
            db.commit()
            db.refresh(doc)

            doc_ids.append(doc.id)
            results.append({
                "filename": file.filename,
                "success": True,
                "document_id": doc.id
            })

        except Exception as e:
            results.append({
                "filename": file.filename,
                "success": False,
                "error": str(e)
            })

    # 批量索引
    for doc_id in doc_ids:
        background_tasks.add_task(_index_document_task, doc_id)

    return {
        "success": True,
        "total": len(files),
        "results": results,
        "message": f"已上传 {len(doc_ids)} 个文件，后台索引中"
    }


@router.get("/documents/{doc_id}/content")
async def get_document_content(
    doc_id: int,
    current_admin=Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """获取文档原始内容（管理员）"""
    doc = db.query(KnowledgeDocument).filter(KnowledgeDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="文档不存在")

    if not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="文件不存在")

    try:
        with open(doc.file_path, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"读取文件失败: {e}")

    return {
        "id": doc.id,
        "title": doc.title,
        "file_path": doc.file_path,
        "content": content
    }

r'''
@router.get("/documents/{doc_id}/preview")
async def get_document_preview(
    doc_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """鑾峰彇鏂囨。鍙緵鐢ㄦ埛閲忚鐨勯瑙堝唴瀹?"""
    doc = db.query(KnowledgeDocument).filter(KnowledgeDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="鏂囨。涓嶅瓨鍦?)

    if not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="鏂囦欢涓嶅瓨鍦?)

    try:
        with open(doc.file_path, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"璇诲彇鏂囦欢澶辫触: {e}")

    return {
        "id": doc.id,
        "title": doc.title,
        "grade_level": doc.grade_level,
        "subject": doc.subject,
        "topic": doc.topic,
        "source": doc.source,
        "tags": doc.tags or [],
        "content": content,
    }
'''


@router.get("/documents/{doc_id}/preview")
async def get_document_preview(
    doc_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取文档只读预览内容（普通登录用户可访问）。"""
    doc = db.query(KnowledgeDocument).filter(KnowledgeDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="文档不存在")

    if not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="文件不存在")

    try:
        with open(doc.file_path, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"读取文件失败: {e}")

    return {
        "id": doc.id,
        "title": doc.title,
        "grade_level": doc.grade_level,
        "subject": doc.subject,
        "topic": doc.topic,
        "source": doc.source,
        "tags": doc.tags or [],
        "content": content,
    }


@router.put("/documents/{doc_id}")
async def update_document(
    doc_id: int,
    body: DocumentCreateOnline,
    background_tasks: BackgroundTasks,
    current_admin=Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """更新文档内容（管理员）"""
    doc = db.query(KnowledgeDocument).filter(KnowledgeDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="文档不存在")

    # 更新文件内容
    try:
        with open(doc.file_path, "w", encoding="utf-8") as f:
            f.write(body.content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文件写入失败: {e}")

    # 更新数据库记录
    doc.title = body.title
    doc.grade_level = body.grade_level
    doc.subject = body.subject
    doc.topic = body.topic
    doc.difficulty = body.difficulty
    doc.source = body.source
    doc.tags = body.tags or []
    doc.status = "pending"
    db.commit()

    # 重新索引
    background_tasks.add_task(_index_document_task, doc_id)

    return {
        "success": True,
        "document_id": doc_id,
        "message": "文档已更新并重新索引"
    }


@router.delete("/documents/{doc_id}")
async def delete_document(
    doc_id: int,
    current_admin=Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """删除文档（管理员）"""
    success = RAGService.delete_document(db, doc_id)
    if not success:
        raise HTTPException(status_code=404, detail="文档不存在")
    return {"success": True, "message": "文档已删除"}


@router.post("/documents/{doc_id}/reindex")
async def reindex_document(
    doc_id: int,
    background_tasks: BackgroundTasks,
    current_admin=Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """重建单个文档索引（管理员）"""
    doc = db.query(KnowledgeDocument).filter(KnowledgeDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="文档不存在")

    background_tasks.add_task(_index_document_task, doc_id)
    return {"success": True, "message": "重新索引已提交，后台处理中"}


@router.post("/scan")
async def scan_corpus(
    background_tasks: BackgroundTasks,
    current_admin=Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    扫描 corpus 目录批量索引（管理员）

    扫描 knowledge_base/corpus/ 下所有 .md 文件并建立索引
    """
    background_tasks.add_task(_scan_task)
    return {"success": True, "message": "扫描任务已启动，请稍后查看文档列表"}


@router.get("/stats")
async def get_stats(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取知识库统计信息"""
    return RAGService.get_stats(db)


# ─── 后台任务 ─────────────────────────────────────────────────────────────────

def _index_document_task(doc_id: int):
    """后台索引任务"""
    from database import SessionLocal
    db = SessionLocal()
    try:
        result = RAGService.index_document(db, doc_id)
        if result["success"]:
            logger.info(f"后台索引完成: doc_id={doc_id}, chunks={result['chunk_count']}")
        else:
            logger.error(f"后台索引失败: doc_id={doc_id}, error={result['error']}")
    finally:
        db.close()


def _scan_task():
    """后台扫描任务"""
    from database import SessionLocal
    db = SessionLocal()
    try:
        stats = RAGService.scan_and_index(db)
        logger.info(f"扫描完成: {stats}")
    finally:
        db.close()
