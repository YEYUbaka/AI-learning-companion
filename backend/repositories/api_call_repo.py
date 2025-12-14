"""
API调用日志仓储
作者：智学伴开发团队
目的：封装API调用日志的数据库操作
"""
from datetime import datetime, time, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date, extract
from models.api_call_log import APICallLog


class APICallRepository:
    """API调用日志仓储类"""

    @staticmethod
    def record_call(
        db: Session,
        provider: Optional[str],
        source: str = "user",
        success: bool = True
    ) -> APICallLog:
        log = APICallLog(
            provider=provider,
            source=source,
            success=success
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log

    @staticmethod
    def count_total(db: Session) -> int:
        """统计总调用次数"""
        return db.query(func.count(APICallLog.id)).scalar() or 0

    @staticmethod
    def count_today(db: Session) -> int:
        """统计当天调用次数（按系统本地时区）"""
        now = datetime.now()
        today = now.date()
        start = datetime.combine(today, time.min)
        end = datetime.combine(today, time.max)
        return (
            db.query(func.count(APICallLog.id))
            .filter(APICallLog.created_at >= start, APICallLog.created_at <= end)
            .scalar()
            or 0
        )

    @staticmethod
    def get_provider_stats(db: Session) -> List[Dict[str, Any]]:
        """获取各模型API调用比例统计"""
        results = (
            db.query(
                APICallLog.provider,
                func.count(APICallLog.id).label('count')
            )
            .filter(APICallLog.provider.isnot(None))
            .group_by(APICallLog.provider)
            .order_by(func.count(APICallLog.id).desc())
            .all()
        )
        return [
            {"name": result.provider or "未知", "value": result.count}
            for result in results
        ]

    @staticmethod
    def get_source_stats(db: Session) -> List[Dict[str, Any]]:
        """获取各功能调用占比统计"""
        results = (
            db.query(
                APICallLog.source,
                func.count(APICallLog.id).label('count')
            )
            .group_by(APICallLog.source)
            .order_by(func.count(APICallLog.id).desc())
            .all()
        )
        # 映射 source 到中文名称
        source_names = {
            "user": "用户对话",
            "admin_test": "管理员测试",
            "quiz": "AI测评",
            "learning_map": "知识图谱",
            "study_plan": "学习计划",
        }
        return [
            {
                "name": source_names.get(result.source, result.source),
                "value": result.count
            }
            for result in results
        ]

    @staticmethod
    def get_daily_stats(db: Session, days: int = 7) -> List[Dict[str, Any]]:
        """获取最近几日的API调用情况（按日期分组，使用系统本地时区）"""
        now = datetime.now()
        end_date = now.date()
        start_date = end_date - timedelta(days=days - 1)
        
        # 计算本地时区的开始和结束时间
        start_datetime = datetime.combine(start_date, time.min)
        end_datetime = datetime.combine(end_date, time.max)
        
        # 获取时间范围内的所有记录
        logs = (
            db.query(APICallLog)
            .filter(
                APICallLog.created_at >= start_datetime,
                APICallLog.created_at <= end_datetime
            )
            .all()
        )
        
        # 在Python中按本地时区的日期分组统计
        date_dict = {}
        for log in logs:
            # 使用本地时区获取日期
            if log.created_at.tzinfo is None:
                # 如果没有时区信息，直接使用（假设是本地时区）
                log_date = log.created_at.date()
            else:
                # 如果有时区信息，转换为本地时区后获取日期
                log_date = log.created_at.astimezone().replace(tzinfo=None).date()
            
            if start_date <= log_date <= end_date:
                date_dict[log_date] = date_dict.get(log_date, 0) + 1
        
        # 创建完整的日期范围，填充缺失的日期为0
        stats = []
        current_date = start_date
        while current_date <= end_date:
            stats.append({
                "date": current_date.strftime("%m-%d"),
                "count": date_dict.get(current_date, 0)
            })
            current_date += timedelta(days=1)
        
        return stats

    @staticmethod
    def get_hourly_stats(db: Session) -> List[Dict[str, Any]]:
        """获取最近24小时的API调用情况（按小时分组，使用系统本地时区）"""
        now = datetime.now()
        # 获取最近24小时的数据（从24小时前到当前时间）
        start_time = now - timedelta(hours=23, minutes=59, seconds=59)
        
        # 获取时间范围内的所有记录
        logs = (
            db.query(APICallLog)
            .filter(APICallLog.created_at >= start_time)
            .all()
        )
        
        # 在Python中按本地时区的小时分组统计
        hour_dict = {}
        for log in logs:
            # 使用本地时区
            if log.created_at.tzinfo is None:
                # 如果没有时区信息，直接使用（假设是本地时区）
                log_datetime = log.created_at
            else:
                # 如果有时区信息，转换为本地时区
                log_datetime = log.created_at.astimezone().replace(tzinfo=None)
            
            # 获取日期和小时
            date_key = log_datetime.date()
            hour_key = log_datetime.hour
            key = (date_key, hour_key)
            hour_dict[key] = hour_dict.get(key, 0) + 1
        
        # 生成完整的24小时数据点（从24小时前到现在）
        stats = []
        current_time = start_time.replace(minute=0, second=0, microsecond=0)
        end_time = now.replace(minute=0, second=0, microsecond=0)
        
        while current_time <= end_time:
            date_key = current_time.date()
            hour_key = current_time.hour
            count = hour_dict.get((date_key, hour_key), 0)
            
            # 格式化显示：如果是今天，只显示小时；如果是昨天，显示"昨天 HH:00"
            if current_time.date() == now.date():
                time_label = f"{hour_key:02d}:00"
            else:
                time_label = f"昨天 {hour_key:02d}:00"
            
            stats.append({
                "date": time_label,
                "count": count
            })
            current_time += timedelta(hours=1)
        
        return stats

    @staticmethod
    def get_logs(
        db: Session,
        skip: int = 0,
        limit: int = 100,
        provider: Optional[str] = None,
        source: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[APICallLog]:
        """获取API调用日志列表"""
        query = db.query(APICallLog)
        
        if provider:
            query = query.filter(APICallLog.provider == provider)
        if source:
            query = query.filter(APICallLog.source == source)
        if start_date:
            query = query.filter(APICallLog.created_at >= start_date)
        if end_date:
            query = query.filter(APICallLog.created_at <= end_date)

        # 说明：
        #  - 这里使用自增主键 id 进行倒序排序，而不是按 created_at 排序
        #  - 原因是历史数据曾进行过一次「+8 小时」的批量校正，导致 created_at
        #    存在与真实时间不完全一致的情况，以时间排序会出现“新日志不在第一页顶端”的现象
        #  - 对于日志列表场景，按 id 倒序可以稳定保证「最新写入的记录在最上方」
        return (
            query.order_by(APICallLog.id.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    @staticmethod
    def count_logs(
        db: Session,
        provider: Optional[str] = None,
        source: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> int:
        """统计API调用日志总数"""
        query = db.query(func.count(APICallLog.id))
        
        if provider:
            query = query.filter(APICallLog.provider == provider)
        if source:
            query = query.filter(APICallLog.source == source)
        if start_date:
            query = query.filter(APICallLog.created_at >= start_date)
        if end_date:
            query = query.filter(APICallLog.created_at <= end_date)
        
        return query.scalar() or 0

