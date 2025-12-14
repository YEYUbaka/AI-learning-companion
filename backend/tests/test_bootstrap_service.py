"""
BootstrapService 测试
作者：智学伴开发团队
目的：验证 .env 种子同步逻辑
运行：pytest backend/tests/test_bootstrap_service.py -v
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from repositories.model_config_repo import ModelConfigRepository
from repositories.prompt_repo import PromptRepository
from services.bootstrap_service import BootstrapService


@pytest.fixture
def db_session():
    """创建内存数据库会话"""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)


def test_sync_prompts_from_data_creates_new_prompt(db_session):
    """应根据种子创建新的 Prompt 并启用"""
    seeds = [
        {
            "name": "chat_system_prompt",
            "content": "系统提示词内容",
            "description": "测试描述",
            "enabled": True,
        }
    ]

    changes = BootstrapService.sync_prompts_from_data(db_session, seeds)
    prompts = PromptRepository.get_all(db_session)

    assert changes == 1
    assert len(prompts) == 1
    assert prompts[0].enabled is True
    assert prompts[0].description == "测试描述"


def test_sync_prompts_updates_existing_version(db_session):
    """相同内容时不应创建新版本，只需更新描述/状态"""
    PromptRepository.create(
        db_session,
        name="chat_system_prompt",
        content="保持一致的内容",
        description="旧描述",
        enabled=False,
        author="tester",
    )

    seeds = [
        {
            "name": "chat_system_prompt",
            "content": "保持一致的内容",
            "description": "新描述",
            "enabled": True,
        }
    ]

    changes = BootstrapService.sync_prompts_from_data(db_session, seeds)
    prompts = PromptRepository.get_by_name(db_session, "chat_system_prompt")

    assert changes == 1  # 状态/描述发生改变
    assert len(prompts) == 1  # 没有创建新版本
    assert prompts[0].description == "新描述"
    assert prompts[0].enabled is True


def test_sync_models_upserts_configs(db_session):
    """模型配置应支持插入与更新"""
    existing = ModelConfigRepository.create(
        db_session,
        provider_name="deepseek",
        api_key="old",
        base_url="https://old.example.com",
        enabled=False,
        priority=10,
        params={"model": "deepseek-chat"},
    )

    seeds = [
        {
            "provider_name": "deepseek",
            "api_key": "new-key",
            "base_url": "https://new.example.com",
            "enabled": True,
            "priority": 99,
            "params": {"model": "deepseek-chat", "temperature": 0.2},
        },
        {
            "provider_name": "qwen",
            "api_key": "qwen-key",
            "base_url": "https://qwen.example.com",
            "enabled": True,
            "priority": 50,
            "params": {"model": "qwen-turbo"},
        },
    ]

    changes = BootstrapService.sync_models_from_data(db_session, seeds)
    updated = ModelConfigRepository.get_by_provider(db_session, "deepseek")
    new_model = ModelConfigRepository.get_by_provider(db_session, "qwen")

    assert changes == 2
    assert updated.api_key == "new-key"
    assert updated.base_url == "https://new.example.com"
    assert updated.enabled is True
    assert updated.priority == 99
    assert updated.params["temperature"] == 0.2

    assert new_model is not None
    assert new_model.base_url == "https://qwen.example.com"
    assert new_model.priority == 50

