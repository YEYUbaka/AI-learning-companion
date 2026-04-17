"""
Agent stream routes served over SSE.
"""
import asyncio
import json
from contextlib import suppress
from typing import AsyncGenerator, Optional

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.config import settings
from core.logger import logger
from core.security import get_current_user
from database import get_db
from repositories.agent_repo import AgentRepository
from services.agent_service import AgentService


router = APIRouter(prefix="/api/agent", tags=["agent-stream"])

SSE_STREAM_DONE = object()


def encode_sse_data(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def encode_sse_comment(comment: str = "ping") -> str:
    return f": {comment}\n\n"


async def stream_with_heartbeat(
    queue: "asyncio.Queue[object]",
    heartbeat_interval: float,
) -> AsyncGenerator[str, None]:
    while True:
        try:
            item = await asyncio.wait_for(queue.get(), timeout=heartbeat_interval)
        except asyncio.TimeoutError:
            yield encode_sse_comment()
            continue

        if item is SSE_STREAM_DONE:
            break

        yield str(item)


class AgentTaskStreamRequest(BaseModel):
    goal: str
    mode: str = "react"
    context: Optional[dict] = None


async def _produce_agent_events(
    queue: "asyncio.Queue[object]",
    request: AgentTaskStreamRequest,
    db: Session,
    user_id: int,
) -> None:
    try:
        session = AgentRepository.create_session(
            db,
            user_id=user_id,
            session_type=request.mode,
            goal=request.goal,
            context=request.context,
        )
        await queue.put(
            encode_sse_data({"type": "session_created", "session_id": session.id})
        )

        agent_service = AgentService(db)
        async for event in agent_service.execute_task_stream(
            user_id,
            session.id,
            request.goal,
            request.mode,
        ):
            await queue.put(encode_sse_data(event))
            await asyncio.sleep(0.01)

        await queue.put("data: [DONE]\n\n")
    except Exception as exc:  # pylint: disable=broad-except
        logger.exception("流式任务执行失败: %s", exc)
        await queue.put(encode_sse_data({"type": "error", "error": str(exc)}))
    finally:
        await queue.put(SSE_STREAM_DONE)


@router.post("/task/stream")
async def create_agent_task_stream(
    request: AgentTaskStreamRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    queue: "asyncio.Queue[object]" = asyncio.Queue()
    producer_task = asyncio.create_task(
        _produce_agent_events(queue, request, db, current_user.id)
    )

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            async for chunk in stream_with_heartbeat(
                queue,
                settings.AI_STREAM_HEARTBEAT_INTERVAL_SECONDS,
            ):
                yield chunk
        finally:
            if not producer_task.done():
                producer_task.cancel()
                with suppress(asyncio.CancelledError):
                    await producer_task

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
