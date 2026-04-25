"""
Question bank repository.
"""
from __future__ import annotations

import re
from typing import Dict, List, Optional, Sequence

from sqlalchemy import String, cast
from sqlalchemy.orm import Session, joinedload

from models.question_bank import QuestionBankAsset, QuestionBankItem


def normalize_stem(stem: str) -> str:
    normalized = re.sub(r"\s+", " ", (stem or "").strip())
    return normalized[:255]


class QuestionBankRepository:
    @staticmethod
    def create_item(db: Session, **kwargs) -> QuestionBankItem:
        item = QuestionBankItem(**kwargs)
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def get_item(db: Session, item_id: int) -> Optional[QuestionBankItem]:
        return (
            db.query(QuestionBankItem)
            .options(joinedload(QuestionBankItem.assets))
            .filter(QuestionBankItem.id == item_id)
            .first()
        )

    @staticmethod
    def list_items(
        db: Session,
        *,
        skip: int = 0,
        limit: int = 50,
        grade_level: Optional[str] = None,
        subject: Optional[str] = None,
        difficulty: Optional[str] = None,
        question_type: Optional[str] = None,
        knowledge_point: Optional[str] = None,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
    ) -> List[QuestionBankItem]:
        query = db.query(QuestionBankItem).options(joinedload(QuestionBankItem.assets))
        if grade_level:
            query = query.filter(QuestionBankItem.grade_level == grade_level)
        if subject:
            query = query.filter(QuestionBankItem.subject == subject)
        if difficulty:
            query = query.filter(QuestionBankItem.difficulty == difficulty)
        if question_type:
            query = query.filter(QuestionBankItem.question_type == question_type)
        if status:
            query = query.filter(QuestionBankItem.status == status)
        if knowledge_point:
            query = query.filter(QuestionBankItem.knowledge_points.is_not(None))
            like_term = f"%{knowledge_point}%"
            query = query.filter(cast(QuestionBankItem.knowledge_points, String).like(like_term))
        if keyword:
            like_term = f"%{keyword.strip()}%"
            query = query.filter(
                (QuestionBankItem.stem.ilike(like_term))
                | (QuestionBankItem.explanation.ilike(like_term))
            )
        return (
            query.order_by(QuestionBankItem.updated_at.desc(), QuestionBankItem.id.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    @staticmethod
    def count_items(
        db: Session,
        *,
        grade_level: Optional[str] = None,
        subject: Optional[str] = None,
        difficulty: Optional[str] = None,
        question_type: Optional[str] = None,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
    ) -> int:
        query = db.query(QuestionBankItem)
        if grade_level:
            query = query.filter(QuestionBankItem.grade_level == grade_level)
        if subject:
            query = query.filter(QuestionBankItem.subject == subject)
        if difficulty:
            query = query.filter(QuestionBankItem.difficulty == difficulty)
        if question_type:
            query = query.filter(QuestionBankItem.question_type == question_type)
        if status:
            query = query.filter(QuestionBankItem.status == status)
        if keyword:
            like_term = f"%{keyword.strip()}%"
            query = query.filter(
                (QuestionBankItem.stem.ilike(like_term))
                | (QuestionBankItem.explanation.ilike(like_term))
            )
        return query.count()

    @staticmethod
    def update_item(db: Session, item_id: int, **kwargs) -> Optional[QuestionBankItem]:
        item = db.query(QuestionBankItem).filter(QuestionBankItem.id == item_id).first()
        if not item:
            return None
        for key, value in kwargs.items():
            setattr(item, key, value)
        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def delete_item(db: Session, item_id: int) -> bool:
        item = db.query(QuestionBankItem).filter(QuestionBankItem.id == item_id).first()
        if not item:
            return False
        db.delete(item)
        db.commit()
        return True

    @staticmethod
    def find_by_normalized_stem(
        db: Session,
        normalized: str,
        *,
        grade_level: Optional[str] = None,
        subject: Optional[str] = None,
    ) -> Optional[QuestionBankItem]:
        query = db.query(QuestionBankItem).filter(QuestionBankItem.normalized_stem == normalized)
        if grade_level:
            query = query.filter(QuestionBankItem.grade_level == grade_level)
        if subject:
            query = query.filter(QuestionBankItem.subject == subject)
        return query.first()

    @staticmethod
    def create_asset(db: Session, **kwargs) -> QuestionBankAsset:
        asset = QuestionBankAsset(**kwargs)
        db.add(asset)
        db.commit()
        db.refresh(asset)
        return asset

    @staticmethod
    def delete_assets_for_item(db: Session, item_id: int, asset_type: Optional[str] = None) -> None:
        query = db.query(QuestionBankAsset).filter(QuestionBankAsset.item_id == item_id)
        if asset_type:
            query = query.filter(QuestionBankAsset.asset_type == asset_type)
        query.delete()
        db.commit()

    @staticmethod
    def pick_candidates(
        db: Session,
        *,
        grade_level: Optional[str],
        subject: Optional[str],
        question_type: Optional[str],
        difficulties: Sequence[str],
        knowledge_points: Sequence[str],
        status: str = "active",
        limit: int = 50,
    ) -> List[QuestionBankItem]:
        query = db.query(QuestionBankItem).options(joinedload(QuestionBankItem.assets))
        if grade_level:
            query = query.filter(QuestionBankItem.grade_level == grade_level)
        if subject:
            query = query.filter(QuestionBankItem.subject == subject)
        if question_type:
            query = query.filter(QuestionBankItem.question_type == question_type)
        if status:
            query = query.filter(QuestionBankItem.status == status)
        if difficulties:
            query = query.filter(QuestionBankItem.difficulty.in_(list(difficulties)))
        items = query.order_by(QuestionBankItem.updated_at.desc(), QuestionBankItem.id.desc()).limit(limit).all()
        if not knowledge_points:
            return items
        scored: List[QuestionBankItem] = []
        exact = []
        neighbors = []
        kp_set = {point for point in knowledge_points if point}
        for item in items:
            item_points = set(item.knowledge_points or [])
            if item_points & kp_set:
                exact.append(item)
            else:
                neighbors.append(item)
        scored.extend(exact)
        scored.extend(neighbors)
        return scored

    @staticmethod
    def bulk_create_items(db: Session, payloads: Sequence[Dict]) -> List[QuestionBankItem]:
        items = [QuestionBankItem(**payload) for payload in payloads]
        db.add_all(items)
        db.commit()
        for item in items:
            db.refresh(item)
        return items
