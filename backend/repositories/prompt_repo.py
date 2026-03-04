"""
Prompt Repository
作者：智学伴开发团队
目的：Prompt数据访问层
"""
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import desc
from models.prompt import Prompt


class PromptRepository:
    """Prompt数据访问类"""
    
    @staticmethod
    def get_by_id(db: Session, prompt_id: int) -> Optional[Prompt]:
        """根据ID获取Prompt"""
        return db.query(Prompt).filter(Prompt.id == prompt_id).first()
    
    @staticmethod
    def get_by_name(db: Session, name: str) -> List[Prompt]:
        """根据名称获取所有版本的Prompt"""
        return db.query(Prompt).filter(Prompt.name == name).order_by(desc(Prompt.version)).all()
    
    @staticmethod
    def get_active_by_name(db: Session, name: str) -> Optional[Prompt]:
        """获取指定名称的最新启用的Prompt"""
        return (
            db.query(Prompt)
            .filter(Prompt.name == name, Prompt.enabled == True)
            .order_by(desc(Prompt.version))
            .first()
        )
    
    @staticmethod
    def get_latest_by_name(db: Session, name: str) -> Optional[Prompt]:
        """获取指定名称的最新Prompt（无论是否启用）"""
        return (
            db.query(Prompt)
            .filter(Prompt.name == name)
            .order_by(desc(Prompt.version))
            .first()
        )
    
    @staticmethod
    def create(db: Session, name: str, content: str, description: Optional[str] = None,
               enabled: bool = True, author: Optional[str] = None) -> Prompt:
        """创建新Prompt（自动版本号+1）"""
        # 获取当前最大版本号
        latest = PromptRepository.get_latest_by_name(db, name)
        next_version = (latest.version + 1) if latest else 1
        
        prompt = Prompt(
            name=name,
            version=next_version,
            content=content,
            description=description,
            enabled=enabled,
            author=author
        )
        db.add(prompt)
        db.commit()
        db.refresh(prompt)
        return prompt
    
    @staticmethod
    def update(db: Session, prompt_id: int, content: Optional[str] = None,
               description: Optional[str] = None, enabled: Optional[bool] = None) -> Optional[Prompt]:
        """更新Prompt"""
        prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
        if prompt:
            if content is not None:
                prompt.content = content
            if description is not None:
                prompt.description = description
            if enabled is not None:
                prompt.enabled = enabled
            db.commit()
            db.refresh(prompt)
        return prompt
    
    @staticmethod
    def delete(db: Session, prompt_id: int) -> bool:
        """删除Prompt"""
        prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
        if prompt:
            db.delete(prompt)
            db.commit()
            return True
        return False
    
    @staticmethod
    def get_all(db: Session, skip: int = 0, limit: int = 100) -> List[Prompt]:
        """获取所有Prompt"""
        return db.query(Prompt).offset(skip).limit(limit).all()
    
    @staticmethod
    def enable_version(db: Session, name: str, version: int) -> Optional[Prompt]:
        """启用指定版本的Prompt，并禁用其他版本"""
        # 禁用该名称的所有版本
        db.query(Prompt).filter(Prompt.name == name).update({"enabled": False})
        
        # 启用指定版本
        prompt = db.query(Prompt).filter(Prompt.name == name, Prompt.version == version).first()
        if prompt:
            prompt.enabled = True
            db.commit()
            db.refresh(prompt)
        return prompt

