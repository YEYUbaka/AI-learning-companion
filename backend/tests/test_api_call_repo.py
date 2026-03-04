"""
API调用日志仓储测试
作者：智学伴开发团队
目的：验证API调用统计逻辑
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta, timezone

from database import Base
from repositories.api_call_repo import APICallRepository
from models.api_call_log import APICallLog


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


def test_record_call_creates_log(db_session):
    """记录API调用后应写入数据库"""
    log = APICallRepository.record_call(db_session, provider="deepseek", source="user_chat", success=True)
    assert log.id is not None
    assert log.provider == "deepseek"
    assert APICallRepository.count_total(db_session) == 1


def test_count_today_filters_by_date(db_session):
    """统计当天调用次数时应忽略历史数据"""
    # 昨天的调用
    yesterday = datetime.now(timezone.utc) - timedelta(days=1)
    old_log = APICallLog(provider="moonshot", source="user_chat", success=True, created_at=yesterday)
    db_session.add(old_log)
    db_session.commit()

    # 今天的调用
    APICallRepository.record_call(db_session, provider="deepseek", source="user_chat", success=True)

    assert APICallRepository.count_today(db_session) == 1


def test_count_total_includes_success_and_failure(db_session):
    """总调用次数应包含成功和失败"""
    APICallRepository.record_call(db_session, provider="deepseek", source="user_chat", success=True)
    APICallRepository.record_call(db_session, provider="deepseek", source="user_chat", success=False)
    assert APICallRepository.count_total(db_session) == 2

