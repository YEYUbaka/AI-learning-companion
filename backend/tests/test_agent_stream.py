"""
Agent stream SSE tests.
"""
import asyncio

import pytest

from routers.agent_stream import SSE_STREAM_DONE, stream_with_heartbeat


@pytest.mark.asyncio
async def test_stream_with_heartbeat_emits_ping_before_late_event():
    queue = asyncio.Queue()

    async def producer():
        await asyncio.sleep(0.02)
        await queue.put("data: hello\n\n")
        await queue.put(SSE_STREAM_DONE)

    producer_task = asyncio.create_task(producer())

    chunks = []
    async for chunk in stream_with_heartbeat(queue, heartbeat_interval=0.01):
        chunks.append(chunk)

    await producer_task

    assert ": ping\n\n" in chunks
    assert "data: hello\n\n" in chunks
    assert chunks.index(": ping\n\n") < chunks.index("data: hello\n\n")
