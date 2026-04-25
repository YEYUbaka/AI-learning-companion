import pytest
from pydantic import ValidationError

from core.config import settings
from schemas.ai import AIRequest


def test_ai_request_accepts_max_token_limit():
    payload = AIRequest(prompt="hello", max_tokens=settings.AI_MAX_TOKEN_LIMIT)

    assert payload.max_tokens == settings.AI_MAX_TOKEN_LIMIT


def test_ai_request_rejects_values_above_max_token_limit():
    with pytest.raises(ValidationError):
        AIRequest(prompt="hello", max_tokens=settings.AI_MAX_TOKEN_LIMIT + 1)
