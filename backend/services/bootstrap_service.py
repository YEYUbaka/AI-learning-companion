"""
启动同步服务
作者：智学伴开发团队
目的：在应用启动时，根据 .env 配置同步 Prompt 与模型配置
"""
from __future__ import annotations

import json
from typing import List, Dict, Any

from sqlalchemy.orm import Session

from core.config import settings
from core.logger import logger
from repositories.prompt_repo import PromptRepository
from repositories.model_config_repo import ModelConfigRepository
from services.prompt_service import PromptService
from utils.seed_loader import SeedLoader


class BootstrapService:
    """负责同步种子数据"""

    @staticmethod
    def sync_from_env(db: Session) -> Dict[str, int]:
        """
        根据配置自动同步数据
        返回变更计数，便于日志
        """
        if not settings.AUTO_SYNC_SEED_DATA:
            logger.info("已禁用自动同步种子数据，跳过处理")
            return {"prompts": 0, "models": 0}

        prompt_seeds = SeedLoader.load_prompt_seed()
        model_seeds = SeedLoader.load_model_seed()

        prompt_changes = BootstrapService.sync_prompts_from_data(db, prompt_seeds)
        model_changes = BootstrapService.sync_models_from_data(db, model_seeds)

        if prompt_changes or model_changes:
            logger.info(
                "已根据配置同步数据：Prompts %s 个，模型配置 %s 个",
                prompt_changes,
                model_changes,
            )
        else:
            logger.info("未检测到需要同步的 Prompt / 模型配置")

        return {"prompts": prompt_changes, "models": model_changes}

    @staticmethod
    def sync_prompts_from_data(db: Session, seeds: List[Dict[str, Any]]) -> int:
        """将提供的 Prompt 数据同步到数据库"""
        if not seeds:
            return 0

        changes = 0
        for item in seeds:
            name = item.get("name")
            content = item.get("content")
            if not name or not content:
                logger.warning("跳过缺失必填字段的 Prompt 种子: %s", item)
                continue

            description = item.get("description")
            enabled = item.get("enabled", True)
            author = item.get("author", "env-sync")

            latest = PromptRepository.get_latest_by_name(db, name)

            if latest and latest.content.strip() == content.strip():
                # 内容相同则只做状态/描述同步
                needs_update = False
                if description is not None and latest.description != description:
                    PromptRepository.update(db, latest.id, description=description)
                    needs_update = True
                if enabled and not latest.enabled:
                    PromptRepository.enable_version(db, name, latest.version)
                    needs_update = True
                if needs_update:
                    PromptService.invalidate_cache(name)
                    changes += 1
                continue

            # 内容不同，创建新版本
            prompt = PromptRepository.create(
                db=db,
                name=name,
                content=content,
                description=description,
                enabled=enabled,
                author=author,
            )
            PromptService.invalidate_cache(name)
            if enabled:
                PromptRepository.enable_version(db, name, prompt.version)
            changes += 1

        return changes

    @staticmethod
    def sync_models_from_data(db: Session, seeds: List[Dict[str, Any]]) -> int:
        """同步模型配置数据"""
        if not seeds:
            return 0

        changes = 0
        for item in seeds:
            provider = item.get("provider_name")
            if not provider:
                logger.warning("跳过缺失 provider_name 的模型种子: %s", item)
                continue

            params = item.get("params")
            if isinstance(params, str):
                params = BootstrapService._safe_json_load(params, default=None)

            existing = ModelConfigRepository.get_by_provider(db, provider)

            if not existing:
                ModelConfigRepository.create(
                    db=db,
                    provider_name=provider,
                    api_key=item.get("api_key"),
                    base_url=item.get("base_url"),
                    priority=item.get("priority", 0),
                    enabled=item.get("enabled", True),
                    params=params,
                )
                changes += 1
                continue

            update_payload: Dict[str, Any] = {}
            for field in ("api_key", "base_url", "priority", "enabled"):
                value = item.get(field)
                if value is not None and getattr(existing, field) != value:
                    update_payload[field] = value

            if params is not None and existing.params != params:
                update_payload["params"] = params

            if update_payload:
                ModelConfigRepository.update(db, existing.id, **update_payload)
                changes += 1

        return changes

    @staticmethod
    def _safe_json_load(raw: str, default: Any = None) -> Any:
        """安全解析 JSON 字符串"""
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("解析模型 params JSON 失败，原始值: %s", raw)
            return default


__all__ = ["BootstrapService"]

