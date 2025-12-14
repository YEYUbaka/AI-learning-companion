"""
知识图谱路由
作者：智学伴开发团队
"""
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from services.learning_map_service import LearningMapService
from typing import Optional
from schemas.learning_map import (
    LearningMapUploadResponse,
    LearningMapGenerateRequest,
    LearningMapGenerateResponse,
    LearningGraphResponse,
    LearningMapHistoryResponse,
)


router = APIRouter(prefix="/api/v1/learning-map", tags=["知识图谱"])


@router.post("/upload-file", response_model=LearningMapUploadResponse)
async def upload_learning_file(
    user_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    上传资料并解析文本
    """
    try:
        result = await LearningMapService.upload_file(db, user_id=user_id, file=file)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"上传失败: {exc}",
        )


@router.post("/generate", response_model=LearningMapGenerateResponse)
async def generate_learning_map(
    request: LearningMapGenerateRequest,
    db: Session = Depends(get_db),
):
    """
    根据文件或课程主题生成知识图谱
    """
    try:
        result = LearningMapService.generate_graph(
            db,
            user_id=request.user_id,
            file_id=request.file_id,
            course_topic=request.course_topic,
            provider=request.provider,
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生成知识图谱失败: {exc}",
        )


@router.get("/{user_id}/graph", response_model=LearningGraphResponse)
async def get_learning_graph(
    user_id: int,
    session_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """
    获取用户知识图谱数据
    """
    try:
        graph = LearningMapService.get_graph(db, user_id, session_id=session_id)
        return graph
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"查询知识图谱失败: {exc}",
        )


@router.get("/{user_id}/history", response_model=LearningMapHistoryResponse)
async def list_learning_history(
    user_id: int,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    """
    获取用户近期知识图谱历史
    """
    try:
        sessions = LearningMapService.get_history(db, user_id, limit=limit)
        return {"sessions": sessions}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"查询知识图谱历史失败: {exc}",
        )


@router.delete("/{user_id}/sessions/{session_id}")
async def delete_learning_map_session(
    user_id: int,
    session_id: int,
    db: Session = Depends(get_db),
):
    """
    删除知识图谱会话
    """
    try:
        from repositories.learning_map_repo import LearningMapRepository
        
        success = LearningMapRepository.delete_session(db, user_id, session_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="知识图谱会话不存在",
            )
        return {"success": True, "message": "知识图谱会话已删除"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除知识图谱会话失败: {exc}",
        )

