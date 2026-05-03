"""
Unified AI service helpers.
"""
from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Optional
from uuid import uuid4

import httpx
from sqlalchemy.orm import Session

from core.config import settings
from core.exceptions import UpstreamServiceError
from core.logger import logger
from database import SessionLocal
from repositories.api_call_repo import APICallRepository
from repositories.model_config_repo import ModelConfigRepository
from services.prompt_service import PromptService
from utils.markdown_sanitizer import clean_ai_response
from utils.model_registry import registry, _summarize_http_error


DEFAULT_SYSTEM_PROMPT = "You are a professional AI learning assistant."


class AIService:
    @staticmethod
    def _build_input_items(
        *,
        system_prompt_content: str,
        user_prompt: Optional[str] = None,
        input_items: Optional[List[Dict[str, Any]]] = None,
    ) -> List[Dict[str, Any]]:
        items: List[Dict[str, Any]] = []
        if system_prompt_content:
            items.append({"role": "system", "content": system_prompt_content})
        if input_items:
            items.extend(input_items)
        elif user_prompt is not None:
            items.append({"role": "user", "content": user_prompt})
        return items

    @staticmethod
    def _record_api_call(db: Session, provider: Optional[str], source: str, success: bool) -> None:
        try:
            APICallRepository.record_call(db, provider, source=source, success=success)
        except Exception as exc:  # pylint: disable=broad-except
            logger.warning("Failed to record API call: %s", exc)

    @staticmethod
    def _refresh_provider_from_db(db: Session, provider: Optional[str]) -> None:
        if not provider:
            return
        try:
            config = ModelConfigRepository.get_by_provider(db, provider)
            if not config or not config.enabled:
                return
            runtime_provider = registry.build_provider_from_config(config)
            if runtime_provider is None:
                return
            registry.register_provider(
                provider,
                runtime_provider,
                params=config.params or {},
                aliases=[str(config.id), config.provider_name],
            )
        except Exception as exc:  # pylint: disable=broad-except
            logger.warning("Failed to refresh provider %s from DB before request: %s", provider, exc)

    @staticmethod
    def get_provider_capabilities(provider: Optional[str], db: Optional[Session] = None) -> Dict[str, Any]:
        if not provider:
            return {}
        if db is not None:
            try:
                config = ModelConfigRepository.get_by_provider(db, provider)
                if config and config.enabled:
                    runtime_provider = registry.build_provider_from_config(config)
                    if runtime_provider is not None:
                        return runtime_provider.get_capabilities()
            except Exception as exc:  # pylint: disable=broad-except
                logger.warning("Failed to resolve live provider capabilities for %s: %s", provider, exc)
        return registry.get_provider_capabilities(provider)

    @staticmethod
    async def call_ai_async(
        user_prompt: Optional[str] = None,
        *,
        input_items: Optional[List[Dict[str, Any]]] = None,
        system_prompt_name: str = "system_prompt",
        provider: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = settings.AI_DEFAULT_MAX_TOKENS,
        quality_context: Optional[Dict[str, Any]] = None,
        allow_fallback: bool = True,
        instructions: Optional[str] = None,
        previous_response_id: Optional[str] = None,
        extra_model_args: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        def _runner() -> Dict[str, Any]:
            db = SessionLocal()
            try:
                return AIService.call_ai(
                    db=db,
                    user_prompt=user_prompt,
                    input_items=input_items,
                    system_prompt_name=system_prompt_name,
                    provider=provider,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    quality_context=quality_context,
                    allow_fallback=allow_fallback,
                    instructions=instructions,
                    previous_response_id=previous_response_id,
                    extra_model_args=extra_model_args,
                )
            finally:
                db.close()

        return await asyncio.to_thread(_runner)

    @staticmethod
    async def call_ai_with_tools_async(
        user_prompt: Optional[str] = None,
        *,
        tools: List[Dict[str, Any]],
        input_items: Optional[List[Dict[str, Any]]] = None,
        system_prompt_name: str = "system_prompt",
        provider: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = settings.AI_DEFAULT_MAX_TOKENS,
        quality_context: Optional[Dict[str, Any]] = None,
        allow_fallback: bool = True,
        extra_model_args: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        def _runner() -> Dict[str, Any]:
            db = SessionLocal()
            try:
                return AIService.call_ai_with_tools(
                    db=db,
                    user_prompt=user_prompt,
                    input_items=input_items,
                    tools=tools,
                    system_prompt_name=system_prompt_name,
                    provider=provider,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    quality_context=quality_context,
                    allow_fallback=allow_fallback,
                    extra_model_args=extra_model_args,
                )
            finally:
                db.close()

        return await asyncio.to_thread(_runner)

    @staticmethod
    def call_ai(
        db: Session,
        user_prompt: Optional[str] = None,
        *,
        input_items: Optional[List[Dict[str, Any]]] = None,
        system_prompt_name: str = "system_prompt",
        provider: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = settings.AI_DEFAULT_MAX_TOKENS,
        quality_context: Optional[Dict[str, Any]] = None,
        allow_fallback: bool = True,
        instructions: Optional[str] = None,
        previous_response_id: Optional[str] = None,
        extra_model_args: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        trace_id = str(uuid4())
        system_prompt_content = PromptService.get_system_prompt(db, system_prompt_name) or DEFAULT_SYSTEM_PROMPT
        request_items = AIService._build_input_items(
            system_prompt_content=system_prompt_content,
            user_prompt=user_prompt,
            input_items=input_items,
        )

        try:
            AIService._refresh_provider_from_db(db, provider)
            result = registry.call_with_fallback(
                input_items=request_items,
                preferred_provider=provider,
                allow_fallback=allow_fallback,
                temperature=temperature,
                max_tokens=max_tokens,
                instructions=instructions,
                previous_response_id=previous_response_id,
                **(extra_model_args or {}),
            )
            actual_provider = result.get("provider", provider or "unknown")
            raw_text = result.get("text", "")
            cleaned_text = clean_ai_response(raw_text)
            fallback_used = bool(provider and actual_provider != provider)
            AIService._record_api_call(db, actual_provider, source="user", success=True)
            return {
                "trace_id": trace_id,
                "provider": actual_provider,
                "raw": raw_text,
                "text": cleaned_text,
                "quality_status": "warning" if fallback_used else "pass",
                "confidence": 0.72 if fallback_used else 0.88,
                "fallback_used": fallback_used,
                "evidence": [],
                "tool_calls": result.get("tool_calls", []),
                "metadata": {
                    "usage": result.get("usage", {}),
                    "model": result.get("model", ""),
                    "latency_ms": result.get("latency_ms", 0),
                    "system_prompt_name": system_prompt_name,
                    "quality_context": quality_context or {},
                    "trace_id": trace_id,
                    "provider_format": result.get("provider_format"),
                    "response_id": result.get("response_id"),
                    "capabilities": registry.get_provider_capabilities(actual_provider),
                },
            }
        except UpstreamServiceError:
            AIService._record_api_call(db, provider or "unknown", source="user", success=False)
            raise
        except Exception as exc:  # pylint: disable=broad-except
            AIService._record_api_call(db, provider or "unknown", source="user", success=False)
            logger.error("AI call failed: %s", exc)
            raise Exception(f"AI service unavailable: {exc}") from exc

    @staticmethod
    def call_ai_with_tools(
        db: Session,
        user_prompt: Optional[str] = None,
        *,
        input_items: Optional[List[Dict[str, Any]]] = None,
        tools: List[Dict[str, Any]],
        system_prompt_name: str = "system_prompt",
        provider: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = settings.AI_DEFAULT_MAX_TOKENS,
        quality_context: Optional[Dict[str, Any]] = None,
        allow_fallback: bool = True,
        extra_model_args: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        trace_id = str(uuid4())
        system_prompt_content = PromptService.get_system_prompt(db, system_prompt_name) or DEFAULT_SYSTEM_PROMPT
        request_items = AIService._build_input_items(
            system_prompt_content=system_prompt_content,
            user_prompt=user_prompt,
            input_items=input_items,
        )

        try:
            AIService._refresh_provider_from_db(db, provider)
            result = registry.call_with_function_calling(
                input_items=request_items,
                tools=tools,
                preferred_provider=provider,
                allow_fallback=allow_fallback,
                temperature=temperature,
                max_tokens=max_tokens,
                **(extra_model_args or {}),
            )
            actual_provider = result.get("provider", provider or "unknown")
            raw_text = result.get("text", "")
            cleaned_text = clean_ai_response(raw_text)
            fallback_used = bool(provider and actual_provider != provider)
            AIService._record_api_call(db, actual_provider, source="function_calling", success=True)
            return {
                "trace_id": trace_id,
                "provider": actual_provider,
                "raw": raw_text,
                "text": cleaned_text,
                "tool_calls": result.get("tool_calls", []),
                "quality_status": "warning" if fallback_used else "pass",
                "confidence": 0.74 if fallback_used else 0.91,
                "fallback_used": fallback_used,
                "evidence": [],
                "metadata": {
                    "usage": result.get("usage", {}),
                    "model": result.get("model", ""),
                    "latency_ms": result.get("latency_ms", 0),
                    "system_prompt_name": system_prompt_name,
                    "quality_context": quality_context or {},
                    "trace_id": trace_id,
                    "provider_format": result.get("provider_format"),
                    "response_id": result.get("response_id"),
                    "capabilities": registry.get_provider_capabilities(actual_provider),
                },
            }
        except UpstreamServiceError:
            AIService._record_api_call(db, provider or "unknown", source="function_calling", success=False)
            raise
        except Exception as exc:  # pylint: disable=broad-except
            AIService._record_api_call(db, provider or "unknown", source="function_calling", success=False)
            logger.warning("AI tool call failed: %s", exc)
            raise Exception(f"AI native tool calling unavailable: {exc}") from exc

    @staticmethod
    def test_model_call(db: Session, provider_name: str, test_prompt: str) -> Dict[str, Any]:
        config = ModelConfigRepository.get_by_provider(db, provider_name)
        if not config:
            return {
                "success": False,
                "provider": provider_name,
                "raw_response": "",
                "cleaned_text": "",
                "latency_ms": 0,
                "error": f"Model config not found: {provider_name}",
            }
        if not config.enabled:
            return {
                "success": False,
                "provider": provider_name,
                "raw_response": "",
                "cleaned_text": "",
                "latency_ms": 0,
                "error": f"Model is disabled: {provider_name}",
            }

        provider_instance = registry.build_provider_from_config(config)
        if not provider_instance:
            return {
                "success": False,
                "provider": provider_name,
                "raw_response": "",
                "cleaned_text": "",
                "latency_ms": 0,
                "error": "Model config is missing a valid API key",
            }

        try:
            start_time = asyncio.get_event_loop_policy().get_event_loop().time() if False else None
            started = __import__("time").time()
            result = provider_instance.call(messages=[{"role": "user", "content": test_prompt}])
            latency = (__import__("time").time() - started) * 1000
            raw_text = result.get("text", "")
            cleaned_text = clean_ai_response(raw_text)
            AIService._record_api_call(db, provider_name, source="admin_test", success=True)
            return {
                "success": True,
                "provider": provider_name,
                "raw_response": raw_text,
                "cleaned_text": cleaned_text,
                "latency_ms": latency,
                "error": None,
                "capabilities": provider_instance.get_capabilities(),
            }
        except httpx.HTTPStatusError as exc:
            message, _ = _summarize_http_error(provider_name, exc.response)
            logger.error("Test model call failed: %s", message)
            AIService._record_api_call(db, provider_name, source="admin_test", success=False)
            return {
                "success": False,
                "provider": provider_name,
                "raw_response": "",
                "cleaned_text": "",
                "latency_ms": 0,
                "error": message,
            }
        except Exception as exc:  # pylint: disable=broad-except
            logger.error("Test model call failed: %s", exc)
            AIService._record_api_call(db, provider_name, source="admin_test", success=False)
            return {
                "success": False,
                "provider": provider_name,
                "raw_response": "",
                "cleaned_text": "",
                "latency_ms": 0,
                "error": str(exc),
            }
