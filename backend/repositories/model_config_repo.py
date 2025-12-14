"""
模型配置Repository
作者：智学伴开发团队
目的：模型配置数据访问层
"""
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import desc
from models.model_config import ModelConfig


class ModelConfigRepository:
    """模型配置数据访问类"""
    
    @staticmethod
    def get_by_id(db: Session, config_id: int) -> Optional[ModelConfig]:
        """根据ID获取配置"""
        return db.query(ModelConfig).filter(ModelConfig.id == config_id).first()
    
    @staticmethod
    def get_by_provider(db: Session, provider_name: str) -> Optional[ModelConfig]:
        """根据提供商名称获取配置"""
        return db.query(ModelConfig).filter(ModelConfig.provider_name == provider_name).first()
    
    @staticmethod
    def get_all_enabled(db: Session) -> List[ModelConfig]:
        """获取所有启用的配置（按优先级排序）"""
        return (
            db.query(ModelConfig)
            .filter(ModelConfig.enabled == True)
            .order_by(desc(ModelConfig.priority))
            .all()
        )
    
    @staticmethod
    def get_all(db: Session, skip: int = 0, limit: int = 100) -> List[ModelConfig]:
        """获取所有配置"""
        return db.query(ModelConfig).offset(skip).limit(limit).all()
    
    @staticmethod
    def create(db: Session, provider_name: str, api_key: Optional[str] = None,
               base_url: Optional[str] = None, priority: int = 0,
               enabled: bool = True, params: Optional[dict] = None) -> ModelConfig:
        """创建新配置"""
        config = ModelConfig(
            provider_name=provider_name,
            api_key=api_key,
            base_url=base_url,
            priority=priority,
            enabled=enabled,
            params=params
        )
        db.add(config)
        db.commit()
        db.refresh(config)
        return config
    
    @staticmethod
    def update(
        db: Session,
        config_id: int,
        provider_name: Optional[str] = None,
        api_key: Optional[str] = None,
               base_url: Optional[str] = None, priority: Optional[int] = None,
        enabled: Optional[bool] = None,
        params: Optional[dict] = None,
    ) -> Optional[ModelConfig]:
        """更新配置"""
        config = db.query(ModelConfig).filter(ModelConfig.id == config_id).first()
        if config:
            if provider_name is not None:
                config.provider_name = provider_name
            if api_key is not None:
                config.api_key = api_key
            if base_url is not None:
                config.base_url = base_url
            if priority is not None:
                config.priority = priority
            if enabled is not None:
                config.enabled = enabled
            if params is not None:
                config.params = params
            db.commit()
            db.refresh(config)
        return config
    
    @staticmethod
    def delete(db: Session, config_id: int) -> bool:
        """删除配置"""
        config = db.query(ModelConfig).filter(ModelConfig.id == config_id).first()
        if config:
            db.delete(config)
            db.commit()
            return True
        return False
    
    @staticmethod
    def count_enabled(db: Session) -> int:
        """获取启用的配置数量"""
        return db.query(ModelConfig).filter(ModelConfig.enabled == True).count()

