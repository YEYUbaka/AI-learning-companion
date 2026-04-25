"""
Question bank admin routes.
"""
from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.security import get_current_admin
from database import get_db
from services.question_bank_service import QuestionBankService


router = APIRouter(prefix="/api/v1/question-bank", tags=["question-bank"])


class QuestionBankItemRequest(BaseModel):
    stem: str
    question_type: str
    grade_level: Optional[str] = None
    subject: Optional[str] = None
    difficulty: Optional[str] = None
    knowledge_points: Optional[list] = None
    answer: Any
    explanation: Optional[str] = None
    options: Optional[Any] = None
    source: Optional[str] = None
    source_type: str = "question_bank"
    status: str = "active"
    metadata: Optional[Dict[str, Any]] = None
    expected_updated_at: Optional[str] = None


@router.get("/items")
async def list_question_bank_items(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    grade_level: Optional[str] = None,
    subject: Optional[str] = None,
    difficulty: Optional[str] = None,
    question_type: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    keyword: Optional[str] = None,
    current_user=Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    result = QuestionBankService.list_items(
        db,
        skip=skip,
        limit=limit,
        grade_level=grade_level,
        subject=subject,
        difficulty=difficulty,
        question_type=question_type,
        status=status_filter,
        keyword=keyword,
    )
    return {"success": True, **result}


@router.post("/items")
async def create_question_bank_item(
    request: QuestionBankItemRequest,
    current_user=Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        item = QuestionBankService.create_item(
            db,
            request.model_dump(),
            created_by=current_user.id,
            created_by_name=getattr(current_user, "name", None),
        )
        return {"success": True, "item": item}
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.put("/items/{item_id}")
async def update_question_bank_item(
    item_id: int,
    request: QuestionBankItemRequest,
    current_user=Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        item = QuestionBankService.update_item(
            db,
            item_id,
            request.model_dump(),
            updated_by=current_user.id,
            updated_by_name=getattr(current_user, "name", None),
        )
        return {"success": True, "item": item}
    except ValueError as exc:
        detail = str(exc)
        if "not found" in detail:
            code = status.HTTP_404_NOT_FOUND
        elif "updated by another admin" in detail:
            code = status.HTTP_409_CONFLICT
        else:
            code = status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=str(exc)) from exc


@router.delete("/items/{item_id}")
async def delete_question_bank_item(
    item_id: int,
    current_user=Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    success = QuestionBankService.delete_item(db, item_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="question bank item not found")
    return {"success": True}


@router.post("/items/import")
async def import_question_bank_items(
    file: UploadFile = File(...),
    current_user=Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    result = await QuestionBankService.import_items(
        db,
        file=file,
        created_by=current_user.id,
        created_by_name=getattr(current_user, "name", None),
    )
    return {"success": True, **result}


@router.post("/assets/upload")
async def upload_question_bank_asset(
    item_id: int = Form(...),
    asset_type: str = Form("question_image"),
    sort_order: int = Form(0),
    file: UploadFile = File(...),
    current_user=Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    item = QuestionBankService.get_item_or_404(db, item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="question bank item not found")
    asset = await QuestionBankService.save_asset(
        file=file,
        item_id=item_id,
        asset_type=asset_type,
        sort_order=sort_order,
        db=db,
    )
    return {"success": True, "asset": asset}
