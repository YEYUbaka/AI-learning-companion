"""
Model registry and provider abstraction.
"""
from __future__ import annotations

import json
import re
import threading
import time
from abc import ABC, abstractmethod
from typing import Any, Dict, Generator, Iterable, List, Optional, Tuple

import httpx
from sqlalchemy.orm import Session

from core.config import settings
from core.exceptions import UpstreamServiceError
from core.logger import logger
from core.security import decrypt_api_key
from repositories.model_config_repo import ModelConfigRepository


def _extract_text_from_content_blocks(content: Any) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: List[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
                continue
            if not isinstance(item, dict):
                continue
            if item.get("type") in {"text", "input_text", "output_text"}:
                parts.append(str(item.get("text") or ""))
        return "\n".join(part for part in parts if part).strip()
    if isinstance(content, dict):
        return str(content.get("text") or "")
    return str(content)


def _normalize_messages_to_input_items(messages: Optional[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    for message in messages or []:
        normalized.append(
            {
                "role": message.get("role", "user"),
                "content": message.get("content", ""),
            }
        )
    return normalized


def _normalize_response_content_blocks(content: Any) -> List[Dict[str, Any]]:
    if content is None:
        return []
    if isinstance(content, str):
        return [{"type": "input_text", "text": content}]
    if isinstance(content, list):
        blocks: List[Dict[str, Any]] = []
        for item in content:
            if isinstance(item, str):
                blocks.append({"type": "input_text", "text": item})
                continue
            if not isinstance(item, dict):
                continue
            item_type = item.get("type")
            if item_type in {"text", "input_text"}:
                blocks.append({"type": "input_text", "text": item.get("text", "")})
            elif item_type in {"image", "input_image"}:
                image_url = item.get("image_url") or item.get("url")
                if isinstance(image_url, dict):
                    image_url = image_url.get("url")
                if image_url:
                    blocks.append({"type": "input_image", "image_url": image_url})
            elif item_type == "file_reference":
                file_url = item.get("file_url") or item.get("url") or item.get("file_path")
                label = item.get("text") or item.get("name") or "File reference"
                if file_url:
                    blocks.append({"type": "input_text", "text": f"{label}: {file_url}"})
            elif item_type == "input_file":
                file_url = item.get("file_url") or item.get("url")
                if file_url:
                    blocks.append({"type": "input_file", "file_url": file_url})
        return blocks
    if isinstance(content, dict):
        return _normalize_response_content_blocks([content])
    return [{"type": "input_text", "text": str(content)}]


def _normalize_chat_content_blocks(content: Any) -> List[Dict[str, Any]]:
    if content is None:
        return []
    if isinstance(content, str):
        return [{"type": "text", "text": content}]
    if isinstance(content, list):
        blocks: List[Dict[str, Any]] = []
        for item in content:
            if isinstance(item, str):
                blocks.append({"type": "text", "text": item})
                continue
            if not isinstance(item, dict):
                continue
            item_type = item.get("type")
            if item_type in {"text", "input_text"}:
                blocks.append({"type": "text", "text": item.get("text", "")})
            elif item_type in {"image", "input_image"}:
                image_url = item.get("image_url") or item.get("url")
                if isinstance(image_url, dict):
                    image_url = image_url.get("url")
                if image_url:
                    blocks.append({"type": "image_url", "image_url": {"url": image_url}})
            elif item_type == "file_reference":
                file_url = item.get("file_url") or item.get("url") or item.get("file_path")
                label = item.get("text") or item.get("name") or "File reference"
                if file_url:
                    blocks.append({"type": "text", "text": f"{label}: {file_url}"})
        return blocks
    if isinstance(content, dict):
        return _normalize_chat_content_blocks([content])
    return [{"type": "text", "text": str(content)}]


def _ensure_message_content(
    content: Any,
    *,
    supports_vision: bool,
) -> Any:
    chat_blocks = _normalize_chat_content_blocks(content)
    contains_image = any(block.get("type") == "image_url" for block in chat_blocks)
    if contains_image and not supports_vision:
        raise ValueError("Current model does not support image understanding")
    if not chat_blocks:
        return ""
    if len(chat_blocks) == 1 and chat_blocks[0].get("type") == "text":
        return chat_blocks[0].get("text", "")
    return chat_blocks


def _normalize_input_items(
    *,
    messages: Optional[List[Dict[str, Any]]] = None,
    input_items: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    if input_items is not None:
        return input_items
    return _normalize_messages_to_input_items(messages)


def _extract_response_text(payload: Dict[str, Any]) -> str:
    output = payload.get("output") or []
    texts: List[str] = []
    for item in output:
        if not isinstance(item, dict):
            continue
        if item.get("type") == "message":
            for content in item.get("content") or []:
                if isinstance(content, dict) and content.get("type") == "output_text":
                    texts.append(str(content.get("text") or ""))
        elif item.get("type") == "output_text":
            texts.append(str(item.get("text") or ""))
    if texts:
        return "\n".join(texts).strip()
    return str(payload.get("output_text") or "")


def _extract_response_tool_calls(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    tool_calls: List[Dict[str, Any]] = []
    builtin_tool_types = {
        "tool_call",
        "function_call",
        "web_search",
        "web_search_call",
        "web_extractor",
        "web_extractor_call",
        "knowledge_search",
        "knowledge_search_call",
        "code_interpreter",
        "code_interpreter_call",
        "image_process",
        "image_process_call",
        "mcp",
        "mcp_call",
    }
    for item in payload.get("output") or []:
        if not isinstance(item, dict):
            continue
        item_type = item.get("type")
        if item_type in builtin_tool_types:
            tool_calls.append(item)
            continue
        if item_type == "message":
            for content in item.get("content") or []:
                if isinstance(content, dict) and content.get("type") in builtin_tool_types:
                    tool_calls.append(content)
    return tool_calls


def _flatten_stream_sse_lines(lines: Iterable[str]) -> Iterable[str]:
    for raw_line in lines:
        line = raw_line.strip()
        if not line or line == "data: [DONE]":
            continue
        if line.startswith("data: "):
            yield line[6:]


def _parse_http_error_payload(response: httpx.Response) -> Tuple[str, str]:
    try:
        error_data = response.json()
    except Exception:  # pylint: disable=broad-except
        return "", ""

    error_obj = error_data.get("error") if isinstance(error_data, dict) else {}
    if not isinstance(error_obj, dict):
        error_obj = {}
    code = str(error_obj.get("code") or error_data.get("code") or "").strip()
    detail = str(error_obj.get("message") or error_data.get("message") or "").strip()
    return code, detail


def _summarize_http_error(provider_name: str, response: httpx.Response) -> Tuple[str, str]:
    error_code, detail = _parse_http_error_payload(response)
    detail_lower = detail.lower()
    auth_markers = [
        "api key",
        "invalid api key",
        "incorrect api key",
        "authentication",
        "unauthorized",
        "access token",
        "invalid token",
        "token expired",
        "signature",
    ]

    if error_code == "ModelNotOpen" or "has not activated the model" in detail_lower:
        model_match = re.search(r"model\s+([A-Za-z0-9._:-]+)", detail)
        model_name = model_match.group(1) if model_match else "当前模型"
        return f"{provider_name} 模型未开通：{model_name}，请先在火山方舟控制台开通该模型服务", "configuration"

    if response.status_code == 400:
        if error_code in {"InvalidApiKey", "Unauthorized", "AuthenticationFailed"} or any(marker in detail_lower for marker in auth_markers):
            return f"{provider_name} API key is invalid or expired", "auth"
        if detail:
            return f"{provider_name} request parameters are invalid: {detail[:180]}", "bad_request"
        return f"{provider_name} request parameters are invalid", "bad_request"
    if response.status_code == 401:
        return f"{provider_name} authentication failed", "auth"
    if response.status_code == 403:
        return f"{provider_name} access forbidden", "auth"
    if response.status_code == 404 and detail:
        return f"{provider_name} resource not found: {detail[:180]}", "configuration"
    if response.status_code == 429:
        return f"{provider_name} rate limited", "rate_limit"
    if response.status_code in {500, 502, 503, 504}:
        return f"{provider_name} service is temporarily unavailable", "upstream_server"
    return f"{provider_name} call failed (HTTP {response.status_code})", "other"


def _parse_doubao_model_version(model_name: str) -> Optional[int]:
    match = re.search(r"(\d{6})$", model_name or "")
    if not match:
        return None
    try:
        return int(match.group(1))
    except ValueError:
        return None


def _coerce_optional_bool(value: Any) -> Optional[bool]:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes", "y", "on"}:
            return True
        if normalized in {"false", "0", "no", "n", "off", ""}:
            return False
    return bool(value)


def _infer_doubao_supports_responses(model_name: str, explicit: Optional[Any] = None) -> bool:
    explicit_bool = _coerce_optional_bool(explicit)
    if explicit_bool is not None:
        return explicit_bool
    if not model_name:
        return True
    if model_name == "doubao-1-5-pro-32k-character-250715":
        return False
    version = _parse_doubao_model_version(model_name)
    if version is None:
        return True
    return version >= 250615


def _infer_supports_vision(provider_name: str, model_name: str, explicit: Optional[Any] = None) -> bool:
    explicit_bool = _coerce_optional_bool(explicit)
    if explicit_bool is not None:
        return explicit_bool
    lower_model = (model_name or "").lower()
    if any(token in lower_model for token in ["vision", "vl", "gpt-4o", "gpt-4.1", "claude-3", "gemini"]):
        return True
    if provider_name == "doubao" and re.search(r"doubao-seed-2(?:[.-])?0-(pro|lite|mini)", lower_model):
        return True
    return provider_name == "doubao" and "vision" in lower_model


def _infer_qwen_supports_responses(model_name: str, explicit: Optional[Any] = None) -> bool:
    explicit_bool = _coerce_optional_bool(explicit)
    if explicit_bool is not None:
        return explicit_bool
    lower_model = (model_name or "").lower()
    if lower_model in {"qwen3-max"}:
        return True
    if re.match(r"^qwen3-max-\d{4}-\d{2}-\d{2}$", lower_model):
        return True
    return any(
        lower_model.startswith(prefix)
        for prefix in (
            "qwen3.6-plus",
            "qwen3.6-flash",
            "qwen3.5-plus",
            "qwen3.5-flash",
        )
    )


def _infer_qwen_chat_native_search_support(model_name: str) -> bool:
    lower_model = (model_name or "").lower()
    return any(
        lower_model.startswith(prefix)
        for prefix in (
            "qwen3-max",
            "qwen-max",
            "qwen3.6-plus",
            "qwen3.5-plus",
            "qwen-plus",
            "qwen3.6-flash",
            "qwen3.5-flash",
            "qwen-flash",
            "qwen-turbo",
            "qwq-plus",
            "qwen3.5-omni-plus",
            "qwen3.5-omni-flash",
            "qwen3.5-omni-plus-realtime",
            "qwen3.5-omni-flash-realtime",
            "qwen-plus-character",
            "qwen-flash-character",
        )
    )


def _infer_native_search_mode(
    provider_name: str,
    model_name: str,
    *,
    supports_responses_api: bool,
    explicit: Optional[Any] = None,
) -> str:
    explicit_mode = str(explicit or "").strip().lower()
    if explicit_mode in {"none", "qwen_chat_enable_search", "responses_builtin_tools"}:
        return explicit_mode
    if provider_name == "qwen":
        if supports_responses_api:
            return "responses_builtin_tools"
        if _infer_qwen_chat_native_search_support(model_name):
            return "qwen_chat_enable_search"
        return "none"
    if provider_name == "doubao":
        return "responses_builtin_tools" if supports_responses_api else "none"
    return "none"


def _provider_template(
    *,
    display_name: str,
    default_base_url: str,
    default_model: str,
    available_models: Optional[List[str]] = None,
    tool_calling: bool = False,
    reasoning: bool = False,
    long_output: bool = True,
    supports_responses_api: bool = False,
    supports_vision: bool = False,
    supports_previous_response_id: bool = False,
    native_tools: Optional[List[str]] = None,
    native_search_mode: str = "none",
    requires_extra_headers: bool = False,
    extra_header_keys: Optional[List[str]] = None,
    extra_headers: Optional[Dict[str, str]] = None,
    default_max_tokens: Optional[int] = None,
) -> Dict[str, Any]:
    return {
        "display_name": display_name,
        "default_base_url": default_base_url,
        "default_model": default_model,
        "available_models": available_models or [],
        "requires_extra_headers": requires_extra_headers,
        "extra_header_keys": extra_header_keys or [],
        "extra_headers": extra_headers or {},
        "default_max_tokens": default_max_tokens if default_max_tokens is not None else settings.AI_DEFAULT_MAX_TOKENS,
        "capabilities": {
            "streaming": True,
            "tool_calling": tool_calling,
            "reasoning": reasoning,
            "long_output": long_output,
            "supports_responses_api": supports_responses_api,
            "supports_vision": supports_vision,
            "supports_previous_response_id": supports_previous_response_id,
            "native_tools": native_tools or [],
            "native_search_mode": native_search_mode,
        },
    }


PROVIDER_TEMPLATES: Dict[str, Dict[str, Any]] = {
    "deepseek": _provider_template(
        display_name="DeepSeek",
        default_base_url="https://api.deepseek.com/v1",
        default_model="deepseek-chat",
        available_models=["deepseek-chat", "deepseek-reasoner"],
        tool_calling=True,
        reasoning=True,
    ),
    "zhipu": _provider_template(
        display_name="Zhipu",
        default_base_url="https://open.bigmodel.cn/api/paas/v4",
        default_model="glm-4-flash",
        available_models=["glm-4.7-flash", "glm-4-flash", "glm-4-air", "glm-4"],
        tool_calling=True,
        reasoning=True,
    ),
    "qwen": _provider_template(
        display_name="Qwen",
        default_base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        default_model="qwen-turbo",
        available_models=["qwen-turbo", "qwen-plus", "qwen-max", "qwen-long"],
        tool_calling=True,
        reasoning=True,
        native_search_mode="qwen_chat_enable_search",
    ),
    "xinghuo": _provider_template(
        display_name="Xinghuo",
        default_base_url="https://spark-api-open.xf-yun.com/v1",
        default_model="generalv3.5",
        available_models=["generalv3.5", "generalv3", "lite", "x1"],
    ),
    "wenxin": _provider_template(
        display_name="Wenxin",
        default_base_url="https://qianfan.baidubce.com/v2",
        default_model="ernie-4.0-8k",
        available_models=["ernie-4.0-8k", "ernie-3.5-8k", "ernie-lite-8k"],
        reasoning=True,
    ),
    "moonshot": _provider_template(
        display_name="Moonshot",
        default_base_url="https://api.moonshot.cn/v1",
        default_model="moonshot-v1-32k",
        available_models=["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
        reasoning=True,
    ),
    "siliconflow": _provider_template(
        display_name="SiliconFlow",
        default_base_url="https://api.siliconflow.cn/v1",
        default_model="Qwen/Qwen2.5-7B-Instruct",
        available_models=[],
        tool_calling=True,
        reasoning=True,
    ),
    "openrouter": _provider_template(
        display_name="OpenRouter",
        default_base_url="https://openrouter.ai/api/v1",
        default_model="",
        available_models=[],
        tool_calling=True,
        reasoning=True,
        requires_extra_headers=True,
        extra_header_keys=["HTTP-Referer", "X-Title"],
    ),
    "doubao": _provider_template(
        display_name="Doubao (Volcengine Ark)",
        default_base_url="https://ark.cn-beijing.volces.com/api/v3",
        default_model="",
        available_models=[],
        tool_calling=True,
        reasoning=True,
        supports_responses_api=True,
        supports_previous_response_id=True,
        native_tools=["web_search", "knowledge_search", "image_process", "mcp"],
        native_search_mode="responses_builtin_tools",
    ),
    "openai_compat": _provider_template(
        display_name="OpenAI Compatible",
        default_base_url="",
        default_model="",
        available_models=[],
    ),
}

PROVIDER_ALIASES: Dict[str, str] = {
    "chatglm": "zhipu",
    "glm": "zhipu",
    "kimi": "moonshot",
    "xfy": "xinghuo",
    "xfyun": "xinghuo",
    "siliconflow": "siliconflow",
    "deepseek": "deepseek",
    "doubao": "doubao",
    "ark": "doubao",
    "volcengine": "doubao",
    "openai-compatible": "openai_compat",
    "openai_compat": "openai_compat",
    "openai compat": "openai_compat",
    "智谱": "zhipu",
    "豆包": "doubao",
    "火山方舟": "doubao",
}


class AIProvider(ABC):
    def __init__(
        self,
        *,
        provider_name: str,
        api_key: str,
        base_url: str,
        model_name: str,
        temperature: float,
        max_tokens: int,
        top_p: float,
        extra_headers: Optional[Dict[str, str]] = None,
        timeout: int = 60,
        capabilities: Optional[Dict[str, Any]] = None,
    ):
        self.provider_name = provider_name
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model_name = model_name
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.top_p = top_p
        self.extra_headers = extra_headers or {}
        self.timeout = timeout
        self.capabilities = capabilities or {}

    def get_capabilities(self) -> Dict[str, Any]:
        return dict(self.capabilities)

    @abstractmethod
    def call(
        self,
        *,
        messages: Optional[List[Dict[str, Any]]] = None,
        input_items: Optional[List[Dict[str, Any]]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        raise NotImplementedError

    def call_stream(
        self,
        *,
        messages: Optional[List[Dict[str, Any]]] = None,
        input_items: Optional[List[Dict[str, Any]]] = None,
        **kwargs: Any,
    ) -> Generator[str, None, None]:
        raise NotImplementedError("Streaming is not implemented for this provider")

    def call_with_tools(
        self,
        *,
        tools: List[Dict[str, Any]],
        messages: Optional[List[Dict[str, Any]]] = None,
        input_items: Optional[List[Dict[str, Any]]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        return self.call(messages=messages, input_items=input_items, tools=tools, **kwargs)

    def _build_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            **self.extra_headers,
        }


class OpenAICompatProvider(AIProvider):
    @staticmethod
    def _tools_are_chat_compatible(tools: Optional[List[Dict[str, Any]]]) -> bool:
        if not tools:
            return True
        return all((tool or {}).get("type") == "function" for tool in tools if isinstance(tool, dict))

    def _build_payload(
        self,
        *,
        messages: Optional[List[Dict[str, Any]]] = None,
        input_items: Optional[List[Dict[str, Any]]] = None,
        tools: Optional[List[Dict[str, Any]]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        items = _normalize_input_items(messages=messages, input_items=input_items)
        normalized_messages: List[Dict[str, Any]] = []
        for item in items:
            role = item.get("role", "user")
            normalized_messages.append(
                {
                    "role": role,
                    "content": _ensure_message_content(
                        item.get("content"),
                        supports_vision=bool(self.capabilities.get("supports_vision")),
                    ),
                }
            )
        payload: Dict[str, Any] = {
            "model": kwargs.get("model", self.model_name),
            "messages": normalized_messages,
            "temperature": kwargs.get("temperature", self.temperature),
            "max_tokens": kwargs.get("max_tokens", self.max_tokens),
            "top_p": kwargs.get("top_p", self.top_p),
        }
        if tools:
            if not self._tools_are_chat_compatible(tools):
                raise ValueError(f"{self.provider_name} chat/completions only supports function tools")
            payload["tools"] = tools
            payload["tool_choice"] = kwargs.get("tool_choice", "auto")
        if "enable_search" in kwargs:
            payload["enable_search"] = bool(kwargs["enable_search"])
        if kwargs.get("search_options") is not None:
            payload["search_options"] = kwargs["search_options"]
        return payload

    def call(
        self,
        *,
        messages: Optional[List[Dict[str, Any]]] = None,
        input_items: Optional[List[Dict[str, Any]]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        endpoint = self.base_url + "/chat/completions"
        payload = self._build_payload(messages=messages, input_items=input_items, tools=kwargs.pop("tools", None), **kwargs)
        with httpx.Client(timeout=self.timeout) as client:
            response = client.post(endpoint, json=payload, headers=self._build_headers())
            response.raise_for_status()
            result = response.json()
        message = ((result.get("choices") or [{}])[0] or {}).get("message", {})
        return {
            "text": _extract_text_from_content_blocks(message.get("content")),
            "usage": result.get("usage", {}),
            "model": result.get("model", self.model_name),
            "provider_format": "chat_completions",
            "tool_calls": message.get("tool_calls") or [],
        }

    def call_stream(
        self,
        *,
        messages: Optional[List[Dict[str, Any]]] = None,
        input_items: Optional[List[Dict[str, Any]]] = None,
        **kwargs: Any,
    ) -> Generator[str, None, None]:
        endpoint = self.base_url + "/chat/completions"
        payload = self._build_payload(messages=messages, input_items=input_items, tools=kwargs.pop("tools", None), **kwargs)
        payload["stream"] = True
        start_time = time.time()
        try:
            with httpx.Client(timeout=self.timeout) as client:
                with client.stream("POST", endpoint, json=payload, headers=self._build_headers()) as response:
                    response.raise_for_status()
                    model_name = self.model_name
                    for raw_chunk in _flatten_stream_sse_lines(response.iter_lines()):
                        chunk_data = json.loads(raw_chunk)
                        choice = (chunk_data.get("choices") or [{}])[0] or {}
                        delta = choice.get("delta") or {}
                        content = _extract_text_from_content_blocks(delta.get("content")) or delta.get("content", "")
                        if content:
                            yield f'data: {json.dumps({"type": "token", "content": content}, ensure_ascii=False)}\n\n'
                        if chunk_data.get("model"):
                            model_name = chunk_data["model"]
            latency = (time.time() - start_time) * 1000
            yield f'data: {json.dumps({"type": "done", "latency_ms": round(latency, 2), "model": model_name}, ensure_ascii=False)}\n\n'
        except httpx.HTTPStatusError as exc:
            message, _ = _summarize_http_error(self.provider_name, exc.response)
            yield f'data: {json.dumps({"type": "error", "message": message[:300]}, ensure_ascii=False)}\n\n'
        except Exception as exc:  # pylint: disable=broad-except
            yield f'data: {json.dumps({"type": "error", "message": str(exc)[:300]}, ensure_ascii=False)}\n\n'

    def call_with_tools(
        self,
        *,
        tools: List[Dict[str, Any]],
        messages: Optional[List[Dict[str, Any]]] = None,
        input_items: Optional[List[Dict[str, Any]]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        if not self.capabilities.get("tool_calling"):
            raise ValueError(f"{self.provider_name} does not support native tool calling")
        return self.call(messages=messages, input_items=input_items, tools=tools, **kwargs)


class ResponsesProvider(AIProvider):
    def _build_chat_fallback_provider(self) -> OpenAICompatProvider:
        return OpenAICompatProvider(
            provider_name=self.provider_name,
            api_key=self.api_key,
            base_url=self.base_url,
            model_name=self.model_name,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            top_p=self.top_p,
            extra_headers=self.extra_headers,
            timeout=self.timeout,
            capabilities=self.capabilities,
        )

    @staticmethod
    def _tools_are_chat_compatible(tools: Optional[List[Dict[str, Any]]]) -> bool:
        if not tools:
            return True
        return all((tool or {}).get("type") == "function" for tool in tools if isinstance(tool, dict))

    def _can_fallback_to_chat_completions(
        self,
        *,
        response: httpx.Response,
        tools: Optional[List[Dict[str, Any]]] = None,
        **kwargs: Any,
    ) -> bool:
        if response.status_code not in {404, 405, 501}:
            return False
        if kwargs.get("instructions") or kwargs.get("previous_response_id") or kwargs.get("caching") or kwargs.get("thinking"):
            return False
        return self._tools_are_chat_compatible(tools)

    def _build_payload(
        self,
        *,
        messages: Optional[List[Dict[str, Any]]] = None,
        input_items: Optional[List[Dict[str, Any]]] = None,
        tools: Optional[List[Dict[str, Any]]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        items = _normalize_input_items(messages=messages, input_items=input_items)
        response_input: List[Dict[str, Any]] = []
        for item in items:
            role = item.get("role", "user")
            blocks = _normalize_response_content_blocks(item.get("content"))
            contains_image = any(block.get("type") == "input_image" for block in blocks)
            if contains_image and not self.capabilities.get("supports_vision"):
                raise ValueError("Current model does not support image understanding")
            response_input.append({"role": role, "content": blocks})

        payload: Dict[str, Any] = {
            "model": kwargs.get("model", self.model_name),
            "input": response_input,
            "temperature": kwargs.get("temperature", self.temperature),
            "max_output_tokens": kwargs.get("max_output_tokens", kwargs.get("max_tokens", self.max_tokens)),
        }
        instructions = kwargs.get("instructions")
        if instructions:
            payload["instructions"] = instructions
        previous_response_id = kwargs.get("previous_response_id")
        if previous_response_id and self.capabilities.get("supports_previous_response_id"):
            payload["previous_response_id"] = previous_response_id
        if tools:
            payload["tools"] = tools
        if "caching" in kwargs:
            payload["caching"] = kwargs["caching"]
        if "thinking" in kwargs:
            payload["thinking"] = kwargs["thinking"]
        if "store" in kwargs:
            payload["store"] = kwargs["store"]
        return payload

    def call(
        self,
        *,
        messages: Optional[List[Dict[str, Any]]] = None,
        input_items: Optional[List[Dict[str, Any]]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        endpoint = self.base_url + "/responses"
        tools = kwargs.pop("tools", None)
        payload = self._build_payload(messages=messages, input_items=input_items, tools=tools, **kwargs)
        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.post(endpoint, json=payload, headers=self._build_headers())
                response.raise_for_status()
                result = response.json()
        except httpx.HTTPStatusError as exc:
            if self._can_fallback_to_chat_completions(response=exc.response, tools=tools, **kwargs):
                logger.warning(
                    "Responses API unavailable for %s (%s), falling back to /chat/completions",
                    self.model_name,
                    exc.response.status_code,
                )
                return self._build_chat_fallback_provider().call(
                    messages=messages,
                    input_items=input_items,
                    tools=tools,
                    **kwargs,
                )
            raise
        return {
            "text": _extract_response_text(result),
            "usage": result.get("usage", {}),
            "model": result.get("model", self.model_name),
            "provider_format": "responses",
            "response_id": result.get("id"),
            "tool_calls": _extract_response_tool_calls(result),
            "raw_response": result,
        }

    def call_stream(
        self,
        *,
        messages: Optional[List[Dict[str, Any]]] = None,
        input_items: Optional[List[Dict[str, Any]]] = None,
        **kwargs: Any,
    ) -> Generator[str, None, None]:
        endpoint = self.base_url + "/responses"
        tools = kwargs.pop("tools", None)
        payload = self._build_payload(messages=messages, input_items=input_items, tools=tools, **kwargs)
        payload["stream"] = True
        start_time = time.time()
        try:
            with httpx.Client(timeout=self.timeout) as client:
                with client.stream("POST", endpoint, json=payload, headers=self._build_headers()) as response:
                    response.raise_for_status()
                    model_name = self.model_name
                    for raw_chunk in _flatten_stream_sse_lines(response.iter_lines()):
                        chunk_data = json.loads(raw_chunk)
                        delta = chunk_data.get("delta")
                        if isinstance(delta, str) and delta:
                            yield f'data: {json.dumps({"type": "token", "content": delta}, ensure_ascii=False)}\n\n'
                        elif isinstance(delta, dict):
                            text = delta.get("text") or delta.get("content")
                            if text:
                                yield f'data: {json.dumps({"type": "token", "content": text}, ensure_ascii=False)}\n\n'
                        if chunk_data.get("model"):
                            model_name = chunk_data["model"]
            latency = (time.time() - start_time) * 1000
            yield f'data: {json.dumps({"type": "done", "latency_ms": round(latency, 2), "model": model_name}, ensure_ascii=False)}\n\n'
        except httpx.HTTPStatusError as exc:
            if self._can_fallback_to_chat_completions(response=exc.response, tools=tools, **kwargs):
                logger.warning(
                    "Responses stream unavailable for %s (%s), falling back to /chat/completions",
                    self.model_name,
                    exc.response.status_code,
                )
                yield from self._build_chat_fallback_provider().call_stream(
                    messages=messages,
                    input_items=input_items,
                    tools=tools,
                    **kwargs,
                )
                return
            message, _ = _summarize_http_error(self.provider_name, exc.response)
            yield f'data: {json.dumps({"type": "error", "message": message[:300]}, ensure_ascii=False)}\n\n'
        except Exception as exc:  # pylint: disable=broad-except
            yield f'data: {json.dumps({"type": "error", "message": str(exc)[:300]}, ensure_ascii=False)}\n\n'

    def call_with_tools(
        self,
        *,
        tools: List[Dict[str, Any]],
        messages: Optional[List[Dict[str, Any]]] = None,
        input_items: Optional[List[Dict[str, Any]]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        return self.call(messages=messages, input_items=input_items, tools=tools, **kwargs)


class WenxinProvider(OpenAICompatProvider):
    _TOKEN_URL = "https://aip.baidubce.com/oauth/2.0/token"

    def __init__(
        self,
        *,
        secret_key: str,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.secret_key = secret_key
        self._access_token: Optional[str] = None
        self._token_expires_at: float = 0.0
        self._token_lock = threading.Lock()

    def _get_access_token(self) -> str:
        with self._token_lock:
            if self._access_token and time.time() < self._token_expires_at:
                return self._access_token
            params = {
                "grant_type": "client_credentials",
                "client_id": self.api_key,
                "client_secret": self.secret_key,
            }
            with httpx.Client(timeout=15) as client:
                resp = client.post(self._TOKEN_URL, params=params)
                resp.raise_for_status()
                data = resp.json()
            if "error" in data:
                raise RuntimeError(f"Failed to get Wenxin token: {data.get('error_description', data['error'])}")
            self._access_token = data["access_token"]
            self._token_expires_at = time.time() + int(data.get("expires_in", 2592000)) - 60
            return self._access_token

    def _build_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self._get_access_token()}",
            "Content-Type": "application/json",
            **self.extra_headers,
        }


class ModelRegistry:
    _instance = None
    _providers: Dict[str, AIProvider] = {}
    _provider_params: Dict[str, Dict[str, Any]] = {}
    _provider_aliases: Dict[str, str] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @staticmethod
    def _normalize_provider_name(name: str) -> str:
        raw = (name or "").strip()
        lower = raw.lower()
        return PROVIDER_ALIASES.get(raw, PROVIDER_ALIASES.get(lower, lower))

    def _resolve_provider_name(self, name: Optional[str]) -> Optional[str]:
        raw = (name or "").strip()
        if not raw:
            return raw
        if raw in self._providers:
            return raw
        if raw in self._provider_aliases:
            return self._provider_aliases[raw]
        normalized = self._normalize_provider_name(raw)
        if normalized in self._providers:
            return normalized
        if normalized in self._provider_aliases:
            return self._provider_aliases[normalized]
        return normalized

    def register_provider(
        self,
        name: str,
        provider: AIProvider,
        params: Optional[Dict[str, Any]] = None,
        aliases: Optional[List[str]] = None,
    ) -> None:
        canonical_name = self._normalize_provider_name(name)
        self._providers[canonical_name] = provider
        self._provider_params[canonical_name] = params or {}
        self._provider_aliases[canonical_name] = canonical_name
        if name:
            self._provider_aliases[name] = canonical_name
        for alias in aliases or []:
            alias_text = str(alias).strip()
            if not alias_text:
                continue
            self._provider_aliases[alias_text] = canonical_name
            self._provider_aliases[self._normalize_provider_name(alias_text)] = canonical_name
        logger.info("Registered AI provider: %s", canonical_name)

    def get_provider(self, name: str) -> Optional[AIProvider]:
        return self._providers.get(self._resolve_provider_name(name))

    def get_provider_capabilities(self, name: str) -> Dict[str, Any]:
        provider = self.get_provider(name)
        if provider:
            return provider.get_capabilities()
        normalized = self._normalize_provider_name(name)
        template = PROVIDER_TEMPLATES.get(normalized, PROVIDER_TEMPLATES["openai_compat"])
        return dict(template.get("capabilities") or {})

    def get_provider_params(self, name: str) -> Dict[str, Any]:
        resolved = self._resolve_provider_name(name)
        return dict(self._provider_params.get(resolved, {}))

    def load_from_db(self, db: Session) -> None:
        configs = ModelConfigRepository.get_all_enabled(db)
        self._providers.clear()
        self._provider_params.clear()
        self._provider_aliases.clear()
        for config in configs:
            try:
                provider = self.build_provider_from_config(config)
                if provider is None:
                    continue
                normalized = self._normalize_provider_name(config.provider_name)
                self.register_provider(normalized, provider, params=config.params or {}, aliases=[str(config.id), config.provider_name])
            except Exception as exc:  # pylint: disable=broad-except
                logger.error("Failed to load provider %s: %s", getattr(config, "provider_name", "unknown"), exc)

    def _call_provider(
        self,
        provider_name: str,
        *,
        messages: Optional[List[Dict[str, Any]]] = None,
        input_items: Optional[List[Dict[str, Any]]] = None,
        with_tools: bool = False,
        tools: Optional[List[Dict[str, Any]]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        provider = self._providers[provider_name]
        default_params = self._provider_params.get(provider_name, {})
        call_kwargs = {**default_params, **kwargs}
        start_time = time.time()
        if with_tools:
            result = provider.call_with_tools(messages=messages, input_items=input_items, tools=tools or [], **call_kwargs)
        else:
            result = provider.call(messages=messages, input_items=input_items, **call_kwargs)
        result["provider"] = provider_name
        result["latency_ms"] = (time.time() - start_time) * 1000
        return result

    def call_with_fallback(
        self,
        messages: Optional[List[Dict[str, Any]]] = None,
        preferred_provider: Optional[str] = None,
        allow_fallback: bool = True,
        input_items: Optional[List[Dict[str, Any]]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        providers = list(self._providers.keys())
        if preferred_provider:
            preferred = self._resolve_provider_name(preferred_provider)
            if preferred not in providers:
                raise ValueError(f"Provider not enabled: {preferred_provider}")
            providers = [preferred] + [item for item in providers if item != preferred]
            if not allow_fallback:
                providers = [preferred]
        if not providers:
            raise ValueError("No AI providers configured")

        error_details: List[Dict[str, Any]] = []
        for provider_name in providers:
            try:
                return self._call_provider(provider_name, messages=messages, input_items=input_items, **kwargs)
            except httpx.HTTPStatusError as exc:
                error_msg, category = self._parse_http_error(provider_name, exc.response.status_code, exc.response)
                error_details.append({"provider": provider_name, "error": error_msg, "status_code": exc.response.status_code, "category": category})
                logger.warning("Provider call failed: %s, %s", provider_name, error_msg)
            except httpx.HTTPError as exc:
                error_details.append({"provider": provider_name, "error": str(exc), "status_code": None, "category": "network"})
                logger.warning("Provider call failed: %s, network error: %s", provider_name, exc)
            except Exception as exc:  # pylint: disable=broad-except
                error_msg, status_code, category = self._classify_generic_error(provider_name, str(exc))
                error_details.append({"provider": provider_name, "error": error_msg, "status_code": status_code, "category": category})
                logger.warning("Provider call failed: %s, %s", provider_name, error_msg)
        raise self._build_upstream_error(error_details)

    def call_with_function_calling(
        self,
        messages: Optional[List[Dict[str, Any]]] = None,
        tools: Optional[List[Dict[str, Any]]] = None,
        preferred_provider: Optional[str] = None,
        input_items: Optional[List[Dict[str, Any]]] = None,
        allow_fallback: bool = True,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        tools = tools or []
        providers = list(self._providers.keys())
        tool_capable = [name for name in providers if self._providers[name].get_capabilities().get("tool_calling")]
        fallback_candidates = tool_capable if tool_capable else providers

        if preferred_provider:
            preferred = self._resolve_provider_name(preferred_provider)
            if preferred in fallback_candidates:
                fallback_candidates = [preferred] + [item for item in fallback_candidates if item != preferred]
            elif not allow_fallback:
                raise ValueError(f"Provider does not support native tool calling: {preferred_provider}")
        elif not fallback_candidates:
            raise ValueError("No providers available")

        error_details: List[Dict[str, Any]] = []
        for provider_name in fallback_candidates:
            try:
                return self._call_provider(
                    provider_name,
                    messages=messages,
                    input_items=input_items,
                    with_tools=True,
                    tools=tools,
                    **kwargs,
                )
            except Exception as exc:  # pylint: disable=broad-except
                error_msg, status_code, category = self._classify_generic_error(provider_name, str(exc))
                error_details.append({"provider": provider_name, "error": error_msg, "status_code": status_code, "category": category})
                logger.warning("Tool call failed: %s, %s", provider_name, error_msg)
                if preferred_provider and not allow_fallback:
                    break
        raise self._build_upstream_error(error_details)

    def build_provider_from_config(self, config: Any) -> Optional[AIProvider]:
        normalized = self._normalize_provider_name(config.provider_name)
        template = PROVIDER_TEMPLATES.get(normalized, PROVIDER_TEMPLATES["openai_compat"])
        params: Dict[str, Any] = config.params if isinstance(config.params, dict) else {}
        api_key = decrypt_api_key(config.api_key) if getattr(config, "api_key", None) else ""
        if not api_key:
            return None

        model_name = params.get("model_name") or params.get("model") or template.get("default_model") or ""
        base_url = (getattr(config, "base_url", None) or template.get("default_base_url") or "").rstrip("/")
        if base_url.endswith("/chat/completions"):
            base_url = base_url[: -len("/chat/completions")]
        if base_url.endswith("/responses"):
            base_url = base_url[: -len("/responses")]
        if normalized == "qwen" and base_url and "compatible-mode" not in base_url:
            base_url = "https://dashscope.aliyuncs.com/compatible-mode/v1"

        template_caps = dict(template.get("capabilities") or {})
        supports_responses_api = _coerce_optional_bool(params.get("supports_responses_api"))
        supports_vision = _coerce_optional_bool(params.get("supports_vision"))
        supports_previous_response_id = _coerce_optional_bool(params.get("supports_previous_response_id"))
        native_search_mode = params.get("native_search_mode")

        if normalized == "doubao":
            template_caps["supports_responses_api"] = _infer_doubao_supports_responses(model_name, supports_responses_api)
        elif normalized == "qwen":
            template_caps["supports_responses_api"] = _infer_qwen_supports_responses(model_name, supports_responses_api)
        elif supports_responses_api is not None:
            template_caps["supports_responses_api"] = supports_responses_api

        template_caps["supports_vision"] = _infer_supports_vision(normalized, model_name, supports_vision)
        if supports_previous_response_id is not None:
            template_caps["supports_previous_response_id"] = supports_previous_response_id

        template_caps["native_search_mode"] = _infer_native_search_mode(
            normalized,
            model_name,
            supports_responses_api=bool(template_caps.get("supports_responses_api")),
            explicit=native_search_mode,
        )

        if normalized == "qwen":
            if template_caps["native_search_mode"] == "responses_builtin_tools":
                template_caps["native_tools"] = ["web_search", "web_extractor", "code_interpreter"]
            else:
                template_caps["native_tools"] = []
        elif normalized == "doubao" and template_caps["native_search_mode"] == "none":
            template_caps["native_tools"] = []

        if "native_tools" in params and isinstance(params["native_tools"], list):
            template_caps["native_tools"] = params["native_tools"]

        extra_headers = {**template.get("extra_headers", {}), **(params.get("extra_headers") or {})}
        extra_headers = {key: value for key, value in extra_headers.items() if value}

        provider_kwargs = {
            "provider_name": normalized,
            "api_key": api_key,
            "base_url": base_url,
            "model_name": model_name,
            "temperature": float(params.get("temperature", 0.7)),
            "max_tokens": int(params.get("max_tokens", template.get("default_max_tokens", settings.AI_DEFAULT_MAX_TOKENS))),
            "top_p": float(params.get("top_p", 1.0)),
            "extra_headers": extra_headers,
            "timeout": int(params.get("timeout", 120)),
            "capabilities": template_caps,
        }

        if normalized == "wenxin" and not api_key.startswith("bce-v3/"):
            secret_key = params.get("secret_key", "")
            if ":" in api_key:
                api_key, secret_key = api_key.split(":", 1)
                provider_kwargs["api_key"] = api_key
            return WenxinProvider(secret_key=secret_key, **provider_kwargs)

        if normalized in {"doubao", "qwen"} and template_caps.get("supports_responses_api"):
            return ResponsesProvider(**provider_kwargs)
        return OpenAICompatProvider(**provider_kwargs)

    def _parse_http_error(self, provider_name: str, status_code: int, response: httpx.Response) -> Tuple[str, str]:
        return _summarize_http_error(provider_name, response)

    def _classify_generic_error(self, provider_name: str, error_str: str) -> Tuple[str, Optional[int], str]:
        lowered = (error_str or "").lower()
        if "401" in lowered or "unauthorized" in lowered:
            return f"{provider_name} authentication failed", 401, "auth"
        if "403" in lowered or "forbidden" in lowered:
            return f"{provider_name} access forbidden", 403, "auth"
        if "429" in lowered or "too many requests" in lowered:
            return f"{provider_name} rate limited", 429, "rate_limit"
        if any(token in lowered for token in ["503", "service unavailable"]):
            return f"{provider_name} service unavailable", 503, "upstream_server"
        if any(token in lowered for token in ["500", "502", "504"]):
            return f"{provider_name} service unavailable", 500, "upstream_server"
        if "400" in lowered or "bad request" in lowered:
            return f"{provider_name} request parameters are invalid", 400, "bad_request"
        if "image understanding" in lowered or "does not support image" in lowered:
            return str(error_str), 400, "bad_request"
        return f"{provider_name} call failed: {error_str[:120]}", None, "other"

    @staticmethod
    def _first_status_code(error_details: List[Dict[str, Any]]) -> Optional[int]:
        for detail in error_details:
            if detail.get("status_code") is not None:
                return int(detail["status_code"])
        return None

    def _build_upstream_error(self, error_details: List[Dict[str, Any]]) -> UpstreamServiceError:
        if not error_details:
            return UpstreamServiceError("AI service call failed", http_status=503)

        auth_errors = [item for item in error_details if item.get("category") == "auth"]
        rate_errors = [item for item in error_details if item.get("category") == "rate_limit"]
        network_errors = [item for item in error_details if item.get("category") == "network"]
        server_errors = [item for item in error_details if item.get("category") == "upstream_server"]
        bad_request_errors = [item for item in error_details if item.get("category") == "bad_request"]
        first_error = error_details[0]

        if auth_errors and len(auth_errors) == len(error_details):
            upstream_status = self._first_status_code(auth_errors) or 401
            return UpstreamServiceError(
                f"AI 上游认证失败（上游 HTTP {upstream_status}），请检查管理后台 API Key 配置",
                http_status=502,
                upstream_status=upstream_status,
                provider=auth_errors[0].get("provider"),
            )
        if rate_errors:
            upstream_status = self._first_status_code(rate_errors) or 429
            return UpstreamServiceError(
                "AI provider rate limited the request",
                http_status=503,
                upstream_status=upstream_status,
                provider=rate_errors[0].get("provider"),
            )
        if network_errors and len(network_errors) == len(error_details):
            return UpstreamServiceError(
                "Unable to connect to AI provider",
                http_status=503,
                provider=network_errors[0].get("provider"),
            )
        if server_errors:
            upstream_status = self._first_status_code(server_errors) or 503
            return UpstreamServiceError(
                "AI provider is temporarily unavailable",
                http_status=503 if upstream_status == 503 else 502,
                upstream_status=upstream_status,
                provider=server_errors[0].get("provider"),
            )
        if bad_request_errors and len(bad_request_errors) == len(error_details):
            upstream_status = self._first_status_code(bad_request_errors) or 400
            return UpstreamServiceError(
                bad_request_errors[0]["error"],
                http_status=400,
                upstream_status=upstream_status,
                provider=bad_request_errors[0].get("provider"),
            )
        return UpstreamServiceError(
            first_error["error"],
            http_status=502,
            upstream_status=first_error.get("status_code"),
            provider=first_error.get("provider"),
        )


registry = ModelRegistry()
