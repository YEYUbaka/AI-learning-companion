"""
Prompt服务
作者：智学伴开发团队
目的：Prompt业务逻辑层，支持版本管理和缓存
"""
from typing import Optional, List
from sqlalchemy.orm import Session
from repositories.prompt_repo import PromptRepository
from models.prompt import Prompt
from schemas.admin import PromptCreate, PromptUpdate
from core.logger import logger


class PromptService:
    """Prompt业务逻辑类"""
    
    # 简单内存缓存（生产环境应使用Redis）
    _cache: dict = {}
    _cache_ttl: int = 300  # 5分钟
    
    @staticmethod
    def get_active_prompt(db: Session, name: str) -> Optional[str]:
        """获取启用的Prompt内容（带缓存）"""
        cache_key = f"prompt:{name}"
        
        # 检查缓存
        if cache_key in PromptService._cache:
            cached = PromptService._cache[cache_key]
            import time
            if time.time() - cached["timestamp"] < PromptService._cache_ttl:
                return cached["content"]
        
        # 从数据库获取
        prompt = PromptRepository.get_active_by_name(db, name)
        if prompt:
            content = prompt.content
            # 更新缓存
            import time
            PromptService._cache[cache_key] = {
                "content": content,
                "timestamp": time.time()
            }
            return content
        
        return None
    
    @staticmethod
    def invalidate_cache(name: Optional[str] = None):
        """清除缓存"""
        if name:
            cache_key = f"prompt:{name}"
            PromptService._cache.pop(cache_key, None)
        else:
            PromptService._cache.clear()
        logger.info(f"已清除Prompt缓存: {name or 'all'}")
    
    @staticmethod
    def create_prompt(db: Session, data: PromptCreate) -> Prompt:
        """创建Prompt"""
        prompt = PromptRepository.create(
            db=db,
            name=data.name,
            content=data.content,
            description=data.description,
            enabled=data.enabled,
            author=data.author
        )
        # 清除缓存
        PromptService.invalidate_cache(data.name)
        logger.info(f"创建Prompt: {data.name}, 版本: {prompt.version}")
        return prompt
    
    @staticmethod
    def update_prompt(db: Session, prompt_id: int, data: PromptUpdate) -> Optional[Prompt]:
        """更新Prompt"""
        prompt = PromptRepository.update(
            db=db,
            prompt_id=prompt_id,
            content=data.content,
            description=data.description,
            enabled=data.enabled
        )
        if prompt:
            PromptService.invalidate_cache(prompt.name)
            logger.info(f"更新Prompt: {prompt.name}, ID: {prompt_id}")
        return prompt
    
    @staticmethod
    def get_prompt(db: Session, prompt_id: int) -> Optional[Prompt]:
        """获取Prompt"""
        return PromptRepository.get_by_id(db, prompt_id)
    
    @staticmethod
    def get_prompts_by_name(db: Session, name: str) -> List[Prompt]:
        """获取指定名称的所有版本"""
        return PromptRepository.get_by_name(db, name)
    
    @staticmethod
    def get_all_prompts(db: Session, skip: int = 0, limit: int = 100) -> List[Prompt]:
        """获取所有Prompt"""
        return PromptRepository.get_all(db, skip, limit)
    
    @staticmethod
    def delete_prompt(db: Session, prompt_id: int) -> bool:
        """删除Prompt"""
        prompt = PromptRepository.get_by_id(db, prompt_id)
        if prompt:
            result = PromptRepository.delete(db, prompt_id)
            if result:
                PromptService.invalidate_cache(prompt.name)
                logger.info(f"删除Prompt: {prompt.name}, ID: {prompt_id}")
            return result
        return False
    
    @staticmethod
    def enable_version(db: Session, name: str, version: int) -> Optional[Prompt]:
        """启用指定版本"""
        prompt = PromptRepository.enable_version(db, name, version)
        if prompt:
            PromptService.invalidate_cache(name)
            logger.info(f"启用Prompt版本: {name}, 版本: {version}")
        return prompt

