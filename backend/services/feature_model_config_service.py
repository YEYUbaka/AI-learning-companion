"""功能专属模型配置服务，带 60s 内存缓存"""
from __future__ import annotations

import time
from typing import Optional, Dict, Tuple

from sqlalchemy.orm import Session

from core.logger import logger
from models.feature_model_config import FeatureModelConfig

_FEATURE_KEYS = ["quiz", "paper", "learning_map", "agent"]
_FEATURE_LABELS = {
    "quiz": "智能出题",
    "paper": "试卷生成",
    "learning_map": "知识图谱",
    "agent": "AI助手",
}
_CACHE_TTL = 60  # 秒
_cache: Dict[str, Tuple[Optional[str], float]] = {}  # feature_key -> (provider_name, expire_ts)


class FeatureModelConfigService:

    @staticmethod
    def ensure_defaults(db: Session) -> None:
        """启动时确保4条默认记录存在"""
        for key in _FEATURE_KEYS:
            existing = db.query(FeatureModelConfig).filter(
                FeatureModelConfig.feature_key == key
            ).first()
            if not existing:
                db.add(FeatureModelConfig(feature_key=key, provider_name=None, enabled=True))
        db.commit()
        logger.info("[OK] 功能专属模型配置默认记录已就绪")

    @staticmethod
    def get_all(db: Session) -> list[FeatureModelConfig]:
        return db.query(FeatureModelConfig).order_by(FeatureModelConfig.feature_key).all()

    @staticmethod
    def get_provider_for_feature(db: Session, feature_key: str) -> Optional[str]:
        """获取功能对应的 provider_name，未配置时返回 None（使用全局优先级）"""
        now = time.time()
        if feature_key in _cache and _cache[feature_key][1] > now:
            return _cache[feature_key][0]

        if db is None:
            return None

        config = db.query(FeatureModelConfig).filter(
            FeatureModelConfig.feature_key == feature_key
        ).first()
        provider = config.provider_name if (config and config.enabled and config.provider_name) else None
        _cache[feature_key] = (provider, now + _CACHE_TTL)
        return provider

    @staticmethod
    def update(db: Session, feature_key: str, provider_name: Optional[str], enabled: bool) -> FeatureModelConfig:
        config = db.query(FeatureModelConfig).filter(
            FeatureModelConfig.feature_key == feature_key
        ).first()
        if not config:
            config = FeatureModelConfig(feature_key=feature_key)
            db.add(config)
        config.provider_name = provider_name
        config.enabled = enabled
        db.commit()
        db.refresh(config)
        _cache.pop(feature_key, None)
        return config

    @staticmethod
    def invalidate_cache(feature_key: Optional[str] = None) -> None:
        if feature_key:
            _cache.pop(feature_key, None)
        else:
            _cache.clear()


__all__ = ["FeatureModelConfigService"]
