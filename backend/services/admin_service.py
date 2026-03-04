"""
管理后台服务
作者：智学伴开发团队
目的：管理后台业务逻辑层
"""
from typing import Dict, Any, Optional
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from repositories.user_repo import UserRepository
from repositories.model_config_repo import ModelConfigRepository
from repositories.prompt_repo import PromptRepository
from services.ai_service import AIService
from core.logger import logger
from core.config import settings
from repositories.api_call_repo import APICallRepository


class AdminService:
    """管理后台服务类"""
    
    @staticmethod
    def get_dashboard_stats(db: Session) -> Dict[str, Any]:
        """获取Dashboard统计信息"""
        total_users = UserRepository.count(db)
        active_models = ModelConfigRepository.count_enabled(db)
        total_prompts = len(PromptRepository.get_all(db, skip=0, limit=1000))
        
        api_calls_today = APICallRepository.count_today(db)
        api_calls_total = APICallRepository.count_total(db)
        
        return {
            "total_users": total_users,
            "active_models": active_models,
            "total_prompts": total_prompts,
            "api_calls_today": api_calls_today,
            "api_calls_total": api_calls_total
        }
    
    @staticmethod
    def get_system_config() -> Dict[str, Any]:
        """获取系统配置"""
        return {
            "max_upload_size": settings.MAX_UPLOAD_SIZE,
            "ai_response_token_limit": 8000,
            "markdown_rendering_mode": "react-markdown",
            "logging_level": settings.LOG_LEVEL,
            "other_settings": {
                "ai_timeout": settings.AI_TIMEOUT,
                "default_ai_provider": settings.DEFAULT_AI_PROVIDER
            }
        }
    
    @staticmethod
    def update_system_config(db: Session, config: Dict[str, Any]) -> Dict[str, Any]:
        """更新系统配置（这里简化处理，实际应该存储到数据库）"""
        # TODO: 创建SystemConfig表存储配置
        logger.info(f"更新系统配置: {config}")
        return AdminService.get_system_config()
    
    @staticmethod
    def test_model_call(db: Session, provider_name: str, test_prompt: str) -> Dict[str, Any]:
        """测试模型调用"""
        result = AIService.test_model_call(db, provider_name, test_prompt)
        # 让前端知晓真实调用到的提供商
        if result.get("provider"):
            return result
        return {**result, "provider": provider_name}

    @staticmethod
    def get_chart_data(db: Session, days: int = 7) -> Dict[str, Any]:
        """获取图表数据"""
        provider_stats = APICallRepository.get_provider_stats(db)
        source_stats = APICallRepository.get_source_stats(db)
        
        # 如果选择1天，使用按小时统计；否则使用按天统计
        if days == 1:
            time_stats = APICallRepository.get_hourly_stats(db)
        else:
            time_stats = APICallRepository.get_daily_stats(db, days=days)
        
        return {
            "provider_stats": provider_stats,
            "source_stats": source_stats,
            "daily_stats": time_stats,
            "is_hourly": days == 1  # 标记是否为小时数据
        }

    @staticmethod
    def get_api_logs(
        db: Session,
        skip: int,
        limit: int,
        provider: Optional[str],
        source: Optional[str],
        start_date: Optional[str],
        end_date: Optional[str],
    ) -> Dict[str, Any]:
        logs = APICallRepository.get_logs(
            db,
            skip=skip,
            limit=limit,
            provider=provider,
            source=source,
            start_date=start_date,
            end_date=end_date,
        )
        total = APICallRepository.count_logs(
            db,
            provider=provider,
            source=source,
            start_date=start_date,
            end_date=end_date,
        )
        converted_logs = []
        tz_utc = timezone.utc
        tz_beijing = timezone(timedelta(hours=8))
        for log in logs:
            created_at = log.created_at
            if created_at:
                if created_at.tzinfo is None:
                    local_time = created_at.replace(tzinfo=tz_utc).astimezone(tz_beijing)
                else:
                    local_time = created_at.astimezone(tz_beijing)
                created_str = local_time.isoformat()
            else:
                created_str = None
            converted_logs.append(
                {
                    "id": log.id,
                    "provider": log.provider,
                    "source": log.source,
                    "success": log.success,
                    "created_at": created_str,
                }
            )
        return {
            "logs": converted_logs,
            "total": total,
        }

