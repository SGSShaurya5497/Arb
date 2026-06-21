"""
test_ws.py — test suite for the live spread WebSocket.
"""

import json

from fastapi.testclient import TestClient


def test_ws_connect_and_ping(client: TestClient):
    """
    Tests that a client can connect, establish a WebSocket session,
    and doesn't immediately get disconnected.
    """
    with client.websocket_connect("/ws/spreads") as websocket:
        # If it didn't throw an exception, the connection was successful (HTTP 101).
        pass


from unittest.mock import patch

def test_ws_receives_broadcast(client: TestClient, mock_redis):
    """
    Tests that a message published to the Redis Stream is read by the
    background task and broadcasted to connected WebSockets.
    """
    with client.websocket_connect("/ws/spreads") as websocket:
        
        # Publish a fake price tick to the Redis stream (just like Celery does)
        payload = {
            "symbol": "TESTETF",
            "price": "100.50",
            "nav": "100.00",
            "exchange": "NSE",
        }
        mock_redis.xadd("stream:price_ticks", payload)

        # The background reader should pick it up and push it to the websocket
        data_str = websocket.receive_text()
        data = json.loads(data_str)
        
        # The broadcasted message should contain our payload plus the stream ID
        assert data["symbol"] == "TESTETF"
        assert data["price"] == "100.50"
        assert "id" in data
