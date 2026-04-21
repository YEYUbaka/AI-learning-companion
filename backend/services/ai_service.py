"""
AI 服务
统一封装系统 Prompt 注入、fallback、品牌清洗、日志和追踪元数据。
"""
import asyncio
from typing import Any, Dict, List, Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from core.config import settings
from core.exceptions import UpstreamServiceError
from core.logger import logger
from database import SessionLocal
from repositories.api_call_repo import APICallRepository
from repositories.model_config_repo import ModelConfigRepository
from services.prompt_service import PromptService
from utils.markdown_sanitizer import clean_ai_response
from utils.model_registry import registry


DEFAULT_SYSTEM_PROMPT = "你是一个专业的 AI 学习助手，帮助用户学习和理解知识。"


class AIService:
    """AI 服务类"""

    @staticmethod
    async def call_ai_async(
        user_prompt: str,
        system_prompt_name: str = "system_prompt",
        provider: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = settings.AI_DEFAULT_MAX_TOKENS,
        quality_context: Optional[Dict[str, Any]] = None,
        allow_fallback: bool = True,
    ) -> Dict[str, Any]:
        def _runner() -> Dict[str, Any]:
            db = SessionLocal()
            try:
                return AIService.call_ai(
                    db=db,
                    user_prompt=user_prompt,
                    system_prompt_name=system_prompt_name,
                    provider=provider,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    quality_context=quality_context,
                    allow_fallback=allow_fallback,
                )
            finally:
                db.close()

        return await asyncio.to_thread(_runner)

    @staticmethod
    async def call_ai_with_tools_async(
        user_prompt: str,
        tools: List[Dict[str, Any]],
        system_prompt_name: str = "system_prompt",
        provider: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = settings.AI_DEFAULT_MAX_TOKENS,
        quality_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        def _runner() -> Dict[str, Any]:
            db = SessionLocal()
            try:
                return AIService.call_ai_with_tools(
                    db=db,
                    user_prompt=user_prompt,
                    tools=tools,
                    system_prompt_name=system_prompt_name,
                    provider=provider,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    quality_context=quality_context,
                )
            finally:
                db.close()

        return await asyncio.to_thread(_runner)

    @staticmethod
    def _record_api_call(
        db: Session, provider: Optional[str], source: str, success: bool
    ) -> None:
        try:
            APICallRepository.record_call(
                db, provider, source=source, success=success
            )
        except Exception as log_error:
            logger.warning("记录 API 调用日志失败: %s", log_error)

    # AI-assisted: DeepSeek-V3 2026-01 — 统一AI调用接口、system prompt注入、fallback逻辑
    # Prompt: "请帮我设计一个FastAPI项目的AI调用统一层..."
    # 修改: 品牌替换改为多关键词列表、增加quality_status/confidence等trace元数据、日志写入由开发者实现
    @staticmethod
    def call_ai(
        db: Session,
        user_prompt: str,
        system_prompt_name: str = "system_prompt",
        provider: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = settings.AI_DEFAULT_MAX_TOKENS,
        quality_context: Optional[Dict[str, Any]] = None,
        allow_fallback: bool = True,
    ) -> Dict[str, Any]:
        trace_id = str(uuid4())
        system_prompt_content = (
            PromptService.get_system_prompt(db, system_prompt_name)
            or DEFAULT_SYSTEM_PROMPT
        )
        messages = [
            {"role": "system", "content": system_prompt_content},
            {"role": "user", "content": user_prompt},
        ]

        try:
            result = registry.call_with_fallback(
                messages=messages,
                preferred_provider=provider,
                allow_fallback=allow_fallback,
                temperature=temperature,
                max_tokens=max_tokens,
            )

            actual_provider = result.get("provider", provider or "unknown")
            fallback_used = bool(provider and actual_provider != provider)
            quality_status = "warning" if fallback_used else "pass"
            confidence = 0.72 if fallback_used else 0.86
            raw_text = result.get("text", "")
            cleaned_text = clean_ai_response(raw_text)

            AIService._record_api_call(
                db,
                actual_provider,
                source="user",
                success=True,
            )

            return {
                "trace_id": trace_id,
                "provider": actual_provider,
                "raw": raw_text,
                "text": cleaned_text,
                "quality_status": quality_status,
                "confidence": confidence,
                "fallback_used": fallback_used,
                "evidence": [],
                "metadata": {
                    "usage": result.get("usage", {}),
                    "model": result.get("model", ""),
                    "latency_ms": result.get("latency_ms", 0),
                    "system_prompt_name": system_prompt_name,
                    "quality_context": quality_context or {},
                    "trace_id": trace_id,
                },
            }
        except UpstreamServiceError as exc:
            logger.error("AI 调用失败: %s", exc)
            AIService._record_api_call(
                db, provider or "unknown", source="user", success=False
            )
            raise
        except Exception as exc:
            logger.error("AI 调用失败: %s", exc)
            AIService._record_api_call(
                db, provider or "unknown", source="user", success=False
            )
            raise Exception(f"AI 服务暂时不可用: {str(exc)}")

    @staticmethod
    def call_ai_with_tools(
        db: Session,
        user_prompt: str,
        tools: List[Dict[str, Any]],
        system_prompt_name: str = "system_prompt",
        provider: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = settings.AI_DEFAULT_MAX_TOKENS,
        quality_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        trace_id = str(uuid4())
        system_prompt_content = (
            PromptService.get_system_prompt(db, system_prompt_name)
            or DEFAULT_SYSTEM_PROMPT
        )
        messages = [
            {"role": "system", "content": system_prompt_content},
            {"role": "user", "content": user_prompt},
        ]

        try:
            result = registry.call_with_function_calling(
                messages=messages,
                tools=tools,
                preferred_provider=provider,
                temperature=temperature,
                max_tokens=max_tokens,
            )

            actual_provider = result.get("provider", provider or "unknown")
            fallback_used = bool(provider and actual_provider != provider)
            quality_status = "warning" if fallback_used else "pass"
            confidence = 0.72 if fallback_used else 0.9
            raw_text = result.get("text", "")
            cleaned_text = clean_ai_response(raw_text)

            AIService._record_api_call(
                db,
                actual_provider,
                source="function_calling",
                success=True,
            )

            return {
                "trace_id": trace_id,
                "provider": actual_provider,
                "raw": raw_text,
                "text": cleaned_text,
                "tool_calls": result.get("tool_calls", result.get("function_calls", [])),
                "quality_status": quality_status,
                "confidence": confidence,
                "fallback_used": fallback_used,
                "evidence": [],
                "metadata": {
                    "usage": result.get("usage", {}),
                    "model": result.get("model", ""),
                    "latency_ms": result.get("latency_ms", 0),
                    "system_prompt_name": system_prompt_name,
                    "quality_context": quality_context or {},
                    "trace_id": trace_id,
                },
            }
        except UpstreamServiceError as exc:
            logger.warning("AI Function Calling 调用失败: %s", exc)
            AIService._record_api_call(
                db, provider or "unknown", source="function_calling", success=False
            )
            raise
        except Exception as exc:
            logger.warning("AI Function Calling 璋冪敤澶辫触: %s", exc)
            AIService._record_api_call(
                db, provider or "unknown", source="function_calling", success=False
            )
            raise Exception(f"AI Function Calling 暂时不可用: {str(exc)}")

    @staticmethod
    def test_model_call(
        db: Session,
        provider_name: str,
        test_prompt: str,
    ) -> Dict[str, Any]:
        messages = [{"role": "user", "content": test_prompt}]

        config = ModelConfigRepository.get_by_provider(db, provider_name)
        if not config:
            return {
                "success": False,
                "provider": provider_name,
                "raw_response": "",
                "cleaned_text": "",
                "latency_ms": 0,
                "error": f"未找到模型配置: {provider_name}",
            }
        if not config.enabled:
            return {
                "success": False,
                "provider": provider_name,
                "raw_response": "",
                "cleaned_text": "",
                "latency_ms": 0,
                "error": f"模型已禁用: {provider_name}",
            }

        provider_instance = registry.build_provider_from_config(config)
        if not provider_instance:
            return {
                "success": False,
                "provider": provider_name,
                "raw_response": "",
                "cleaned_text": "",
                "latency_ms": 0,
                "error": "模型缺少有效的 API Key 或未被支持",
            }

        try:
            import time

            start_time = time.time()
            result = provider_instance.call(messages)
            latency = (time.time() - start_time) * 1000
            raw_text = result.get("text", "")
            cleaned_text = clean_ai_response(raw_text)

            AIService._record_api_call(
                db,
                provider_name,
                source="admin_test",
                success=True,
            )

            return {
                "success": True,
                "provider": provider_name,
                "raw_response": raw_text,
                "cleaned_text": cleaned_text,
                "latency_ms": latency,
                "error": None,
            }
        except Exception as exc:  # pylint: disable=broad-except
            logger.error("测试模型调用失败: %s, 错误: %s", provider_name, exc)
            AIService._record_api_call(
                db,
                provider_name,
                source="admin_test",
                success=False,
            )
            return {
                "success": False,
                "provider": provider_name,
                "raw_response": "",
                "cleaned_text": "",
                "latency_ms": 0,
                "error": str(exc),
            }
