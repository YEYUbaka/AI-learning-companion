"""
Prompt 服务
"""
import time
from typing import List, Optional

from sqlalchemy.orm import Session

from core.logger import logger
from models.prompt import Prompt
from repositories.prompt_repo import PromptRepository
from schemas.admin import PromptCreate, PromptUpdate


class PromptService:
    """Prompt 业务逻辑"""

    _cache: dict = {}
    _cache_ttl: int = 300

    @staticmethod
    def get_active_prompt(db: Session, name: str) -> Optional[str]:
        cache_key = f"prompt:{name}"
        cached = PromptService._cache.get(cache_key)
        if cached and time.time() - cached["timestamp"] < PromptService._cache_ttl:
            return cached["content"]

        prompt = PromptRepository.get_active_by_name(db, name)
        if not prompt:
            return None

        PromptService._cache[cache_key] = {
            "content": prompt.content,
            "timestamp": time.time(),
        }
        return prompt.content

    @staticmethod
    def get_system_prompt(
        db: Session, name: str = "system_prompt"
    ) -> Optional[str]:
        return PromptService.get_active_prompt(db, name)

    @staticmethod
    def invalidate_cache(name: Optional[str] = None):
        if name:
            PromptService._cache.pop(f"prompt:{name}", None)
        else:
            PromptService._cache.clear()
        logger.info("已清理 Prompt 缓存: %s", name or "all")

    @staticmethod
    def create_prompt(db: Session, data: PromptCreate) -> Prompt:
        prompt = PromptRepository.create(
            db=db,
            name=data.name,
            content=data.content,
            description=data.description,
            enabled=data.enabled,
            author=data.author,
        )
        PromptService.invalidate_cache(data.name)
        logger.info("创建 Prompt: %s, 版本: %s", data.name, prompt.version)
        return prompt

    @staticmethod
    def update_prompt(
        db: Session, prompt_id: int, data: PromptUpdate
    ) -> Optional[Prompt]:
        prompt = PromptRepository.update(
            db=db,
            prompt_id=prompt_id,
            content=data.content,
            description=data.description,
            enabled=data.enabled,
        )
        if prompt:
            PromptService.invalidate_cache(prompt.name)
            logger.info("更新 Prompt: %s, ID: %s", prompt.name, prompt_id)
        return prompt

    @staticmethod
    def get_prompt(db: Session, prompt_id: int) -> Optional[Prompt]:
        return PromptRepository.get_by_id(db, prompt_id)

    @staticmethod
    def get_prompts_by_name(db: Session, name: str) -> List[Prompt]:
        return PromptRepository.get_by_name(db, name)

    @staticmethod
    def get_all_prompts(
        db: Session, skip: int = 0, limit: int = 100
    ) -> List[Prompt]:
        return PromptRepository.get_all(db, skip, limit)

    @staticmethod
    def delete_prompt(db: Session, prompt_id: int) -> bool:
        prompt = PromptRepository.get_by_id(db, prompt_id)
        if not prompt:
            return False

        result = PromptRepository.delete(db, prompt_id)
        if result:
            PromptService.invalidate_cache(prompt.name)
            logger.info("删除 Prompt: %s, ID: %s", prompt.name, prompt_id)
        return result

    @staticmethod
    def enable_version(db: Session, name: str, version: int) -> Optional[Prompt]:
        prompt = PromptRepository.enable_version(db, name, version)
        if prompt:
            PromptService.invalidate_cache(name)
            logger.info("启用 Prompt 版本: %s, 版本: %s", name, version)
        return prompt
