"""
WebSocket route — live spread broadcasts via Redis Stream subscription.

Architecture:
    1. A background task (`_redis_reader`) runs forever, calling XREAD on
       the Redis stream `stream:price_ticks` with a 500ms blocking timeout.
    2. When a new stream entry arrives, it is put into each connected client's
       asyncio.Queue.
    3. Each WebSocket connection has its own coroutine draining its queue and
       calling websocket.send_text().

Why per-client queues instead of direct broadcast?
    Direct broadcast (iterating clients inside the XREAD loop) means one slow
    or broken client blocks ALL other clients — the send_text() call will hang.
    With queues, each client's delivery is independent. A dropped client only
    affects itself.

Why XREAD and not pub/sub?
    Redis Pub/Sub is fire-and-forget: messages sent while a subscriber is
    disconnected are lost. Redis Streams are persistent: XREAD with a last-
    seen ID lets reconnecting clients replay missed messages (reconnection-
    friendly behavior specified in the requirements).
"""

import asyncio
import json
import logging
from typing import Dict, Set

import redis
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.redis_client import PRICE_TICK_STREAM, get_redis

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])

# ---------------------------------------------------------------------------
# Connection registry
# ---------------------------------------------------------------------------
# A set of asyncio.Queue instances — one per connected WebSocket client.
# The _redis_reader task iterates this set to fan out each new message.
# Using a set (not a list) gives O(1) add/remove.
# ---------------------------------------------------------------------------
_client_queues: Set[asyncio.Queue] = set()

# The last stream entry ID we successfully delivered.
# Stored at module level so if the _redis_reader restarts (e.g., Redis
# reconnect), it resumes from where it left off rather than re-delivering
# old messages.
_last_stream_id: str = "$"   # "$" = only new messages from now on


async def _redis_reader():
    """
    Long-running asyncio background task.
    Reads from the Redis stream and fans out to all connected clients.

    Runs until the application shuts down (cancelled by FastAPI lifespan).
    """
    global _last_stream_id
    r: redis.Redis = get_redis()

    logger.info("WebSocket Redis reader started, listening on %s", PRICE_TICK_STREAM)

    while True:
        try:
            # XREAD with block=500ms: waits up to 500ms for new entries.
            # If no new entries, returns None and we loop again.
            # This gives us a natural place to check for shutdown
            # (asyncio.CancelledError) every 500ms.
            # Run the synchronous Redis call in a thread pool to avoid blocking
            # the FastAPI event loop for 500ms.
            entries = await asyncio.to_thread(
                r.xread,
                {PRICE_TICK_STREAM: _last_stream_id},
                block=500,
                count=10,
            )

            if not entries:
                # Yield control to the event loop — prevents busy-wait.
                await asyncio.sleep(0)
                continue

            # entries = [(stream_key, [(entry_id, fields_dict), ...])]
            for _stream_key, messages in entries:
                for entry_id, fields in messages:
                    _last_stream_id = entry_id  # advance cursor

                    payload = json.dumps({"id": entry_id, **fields})

                    # Fan out to all connected clients via their queues.
                    # put_nowait() is non-blocking: if a client's queue is full
                    # (maxsize=100), we skip that client rather than blocking.
                    dead_queues = set()
                    for q in _client_queues:
                        try:
                            q.put_nowait(payload)
                        except asyncio.QueueFull:
                            logger.warning("Client queue full — skipping slow client")
                            dead_queues.add(q)

                    # Remove persistently slow clients to prevent memory leak.
                    _client_queues.difference_update(dead_queues)

        except asyncio.CancelledError:
            logger.info("WebSocket Redis reader shutting down")
            raise   # re-raise so FastAPI lifespan can clean up

        except Exception as exc:
            # Log Redis errors (connection drop, etc.) but don't crash.
            # The while loop will retry after a short backoff.
            logger.error("Redis reader error: %s — retrying in 2s", exc)
            await asyncio.sleep(2)


@router.websocket("/ws/spreads")
async def ws_spreads(websocket: WebSocket):
    """
    WebSocket endpoint for live spread updates.

    Connection flow:
        1. Client connects to ws://host/ws/spreads
        2. Server accepts and adds client to the broadcast set.
        3. Client receives a JSON message for every new price tick.
        4. On disconnect (client closes tab, network drop, etc.),
           the client's queue is removed cleanly.

    Message format (JSON):
        {
            "id": "1718900000000-0",   // Redis stream entry ID
            "symbol": "NIFTYBEES",
            "price": "273.18",
            "nav": "272.90",
            "exchange": "NSE"
        }

    Reconnection: The stream cursor is server-side (`_last_stream_id`).
    Reconnecting clients will receive messages from the current position
    onward — they won't get a replay of everything they missed, but they
    also won't miss the next message. For full replay, pass a `?from_id=`
    query param in a future version.
    """
    await websocket.accept()

    # Each client gets its own queue (maxsize=100 prevents memory growth
    # if a client stops reading but stays connected).
    queue: asyncio.Queue = asyncio.Queue(maxsize=100)
    _client_queues.add(queue)
    logger.info("WebSocket client connected. Total: %d", len(_client_queues))

    try:
        while True:
            # Wait for the next message from the Redis reader.
            # asyncio.wait_for with a timeout lets us send periodic pings
            # to detect silently-dropped connections.
            try:
                message = await asyncio.wait_for(queue.get(), timeout=30.0)
                await websocket.send_text(message)
            except asyncio.TimeoutError:
                # 30s with no data: send a ping to verify the connection.
                await websocket.send_text(json.dumps({"type": "ping"}))

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected cleanly")
    except Exception as exc:
        logger.warning("WebSocket client dropped unexpectedly: %s", exc)
    finally:
        # Always remove the queue, even on unexpected errors.
        # Without this, the dead client's queue accumulates in _client_queues
        # and the Redis reader wastes time trying to enqueue into it.
        _client_queues.discard(queue)
        logger.info("WebSocket client removed. Remaining: %d", len(_client_queues))
