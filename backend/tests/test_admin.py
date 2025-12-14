"""
管理后台测试
作者：智学伴开发团队
目的：测试管理后台功能
运行：pytest backend/tests/test_admin.py -v
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base
from repositories.model_config_repo import ModelConfigRepository
from services.admin_service import AdminService
from schemas.admin import ModelConfigCreate, ModelTestRequest


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


def test_get_dashboard_stats(db_session):
    """测试获取Dashboard统计"""
    stats = AdminService.get_dashboard_stats(db_session)
    assert "total_users" in stats
    assert "active_models" in stats
    assert "total_prompts" in stats


def test_get_system_config():
    """测试获取系统配置"""
    config = AdminService.get_system_config()
    assert "max_upload_size" in config
    assert "logging_level" in config


def test_create_model_config(db_session):
    """测试创建模型配置"""
    data = ModelConfigCreate(
        provider_name="test_provider",
        api_key="test_key",
        base_url="https://api.test.com",
        priority=1,
        enabled=True
    )
    config = ModelConfigRepository.create(
        db_session,
        provider_name=data.provider_name,
        api_key=data.api_key,
        base_url=data.base_url,
        priority=data.priority,
        enabled=data.enabled
    )
    assert config.provider_name == "test_provider"
    assert config.enabled is True


def test_get_all_enabled_models(db_session):
    """测试获取所有启用的模型"""
    # 创建两个配置，一个启用一个禁用
    ModelConfigRepository.create(
        db_session,
        provider_name="enabled_provider",
        enabled=True,
        priority=1
    )
    ModelConfigRepository.create(
        db_session,
        provider_name="disabled_provider",
        enabled=False,
        priority=2
    )
    
    enabled = ModelConfigRepository.get_all_enabled(db_session)
    assert len(enabled) == 1
    assert enabled[0].provider_name == "enabled_provider"

