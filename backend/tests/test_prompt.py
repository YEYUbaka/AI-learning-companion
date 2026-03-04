"""
Prompt服务测试
作者：智学伴开发团队
目的：测试Prompt CRUD和版本管理功能
运行：pytest backend/tests/test_prompt.py -v
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base
from repositories.prompt_repo import PromptRepository
from services.prompt_service import PromptService
from schemas.admin import PromptCreate, PromptUpdate


@pytest.fixture
def db_session():
    """创建测试数据库会话"""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)


def test_create_prompt(db_session):
    """测试创建Prompt"""
    data = PromptCreate(
        name="test_prompt",
        content="测试内容",
        description="测试描述",
        enabled=True
    )
    prompt = PromptService.create_prompt(db_session, data)
    assert prompt.name == "test_prompt"
    assert prompt.version == 1
    assert prompt.enabled is True


def test_prompt_versioning(db_session):
    """测试Prompt版本管理"""
    data = PromptCreate(
        name="test_prompt",
        content="版本1",
        enabled=True
    )
    prompt1 = PromptService.create_prompt(db_session, data)
    assert prompt1.version == 1
    
    # 创建新版本
    data2 = PromptCreate(
        name="test_prompt",
        content="版本2",
        enabled=True
    )
    prompt2 = PromptService.create_prompt(db_session, data2)
    assert prompt2.version == 2
    
    # 获取所有版本
    prompts = PromptService.get_prompts_by_name(db_session, "test_prompt")
    assert len(prompts) == 2


def test_get_active_prompt(db_session):
    """测试获取启用的Prompt"""
    data = PromptCreate(
        name="system_prompt",
        content="系统提示词",
        enabled=True
    )
    PromptService.create_prompt(db_session, data)
    
    content = PromptService.get_active_prompt(db_session, "system_prompt")
    assert content == "系统提示词"


def test_update_prompt(db_session):
    """测试更新Prompt"""
    data = PromptCreate(
        name="test_prompt",
        content="原始内容",
        enabled=True
    )
    prompt = PromptService.create_prompt(db_session, data)
    
    update_data = PromptUpdate(content="更新后的内容")
    updated = PromptService.update_prompt(db_session, prompt.id, update_data)
    assert updated.content == "更新后的内容"


def test_enable_version(db_session):
    """测试启用指定版本"""
    # 创建两个版本
    data1 = PromptCreate(name="test", content="v1", enabled=False)
    prompt1 = PromptService.create_prompt(db_session, data1)
    
    data2 = PromptCreate(name="test", content="v2", enabled=False)
    prompt2 = PromptService.create_prompt(db_session, data2)
    
    # 启用版本1
    enabled = PromptService.enable_version(db_session, "test", 1)
    assert enabled.version == 1
    assert enabled.enabled is True
    
    # 版本2应该被禁用
    prompt2_updated = PromptService.get_prompt(db_session, prompt2.id)
    assert prompt2_updated.enabled is False

