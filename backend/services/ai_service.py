"""
AI服务
作者：智学伴开发团队
目的：统一AI调用接口，支持fallback和文本清理
"""
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from utils.model_registry import registry
from utils.markdown_sanitizer import clean_ai_response
from services.prompt_service import PromptService
from repositories.api_call_repo import APICallRepository
from repositories.model_config_repo import ModelConfigRepository
from core.logger import logger


class AIService:
    """AI服务类"""
    
    @staticmethod
    def _record_api_call(db: Session, provider: Optional[str], source: str, success: bool) -> None:
        """记录API调用日志，失败时只打印警告"""
        try:
            APICallRepository.record_call(db, provider, source=source, success=success)
        except Exception as log_error:
            logger.warning(f"记录API调用日志失败: {log_error}")
    
    @staticmethod
    def call_ai(
        db: Session,
        user_prompt: str,
        system_prompt_name: str = "system_prompt",
        provider: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000
    ) -> Dict[str, Any]:
        """
        调用AI模型
        
        Args:
            db: 数据库会话
            user_prompt: 用户提示词
            system_prompt_name: 系统Prompt名称
            provider: 指定的提供商（可选）
            temperature: 温度参数
            max_tokens: 最大token数
        
        Returns:
            Dict包含: provider, raw, text, metadata
        """
        # 构建消息列表
        messages = []
        
        # 添加系统Prompt
        system_prompt_content = PromptService.get_active_prompt(db, system_prompt_name)
        if system_prompt_content:
            messages.append({
                "role": "system",
                "content": system_prompt_content
            })
        else:
            # 默认系统Prompt
            messages.append({
                "role": "system",
                "content": "你是一个专业的AI学习助手，帮助用户学习和理解知识。"
            })
        
        # 添加用户消息
        messages.append({
            "role": "user",
            "content": user_prompt
        })
        
        # 调用AI（带fallback）
        try:
            result = registry.call_with_fallback(
                messages=messages,
                preferred_provider=provider,
                temperature=temperature,
                max_tokens=max_tokens
            )
            AIService._record_api_call(
                db,
                result.get("provider", provider or "unknown"),
                source="user",
                success=True
            )
            
            raw_text = result.get("text", "")
            cleaned_text = clean_ai_response(raw_text)
            
            return {
                "provider": result.get("provider", "unknown"),
                "raw": raw_text,
                "text": cleaned_text,
                "metadata": {
                    "usage": result.get("usage", {}),
                    "model": result.get("model", ""),
                    "latency_ms": result.get("latency_ms", 0)
                }
            }
        except Exception as e:
            logger.error(f"AI调用失败: {e}")
            AIService._record_api_call(db, provider or "unknown", source="user", success=False)
            raise Exception(f"AI服务暂时不可用: {str(e)}")
    
    @staticmethod
    def test_model_call(
        db: Session,
        provider_name: str,
        test_prompt: str
    ) -> Dict[str, Any]:
        """测试模型调用（用于管理后台）"""
        messages = [{
            "role": "user",
            "content": test_prompt
        }]

        config = ModelConfigRepository.get_by_provider(db, provider_name)
        if not config:
            return {
                "success": False,
                "provider": provider_name,
                "raw_response": "",
                "cleaned_text": "",
                "latency_ms": 0,
                "error": f"未找到模型配置: {provider_name}"
            }
        if not config.enabled:
            return {
                "success": False,
                "provider": provider_name,
                "raw_response": "",
                "cleaned_text": "",
                "latency_ms": 0,
                "error": f"模型已禁用: {provider_name}"
            }

        provider_bundle = registry.build_provider_from_config(config)
        if not provider_bundle:
            return {
                "success": False,
                "provider": provider_name,
                "raw_response": "",
                "cleaned_text": "",
                "latency_ms": 0,
                "error": "模型缺少有效的 API Key 或未被支持",
            }

        provider, default_params = provider_bundle

        try:
            import time
            start_time = time.time()

            call_kwargs = {**default_params}
            result = provider.call(messages, **call_kwargs)

            latency = (time.time() - start_time) * 1000
            raw_text = result.get("text", "")
            cleaned_text = clean_ai_response(raw_text)

            AIService._record_api_call(
                db,
                provider_name,
                source="admin_test",
                success=True
            )

            return {
                "success": True,
                "provider": provider_name,
                "raw_response": raw_text,
                "cleaned_text": cleaned_text,
                "latency_ms": latency,
                "error": None
            }
        except Exception as e:  # pylint: disable=broad-except
            logger.error("测试模型调用失败: %s, 错误: %s", provider_name, e)
            AIService._record_api_call(db, provider_name, source="admin_test", success=False)
            return {
                "success": False,
                "provider": provider_name,
                "raw_response": "",
                "cleaned_text": "",
                "latency_ms": 0,
                "error": str(e)
            }

