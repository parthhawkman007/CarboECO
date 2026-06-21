from fastapi.testclient import TestClient
import pytest

def test_websocket_ignores_invalid_json_and_continues(client: TestClient):
    with client.websocket_connect("/ws/community") as websocket:
        websocket.receive_json() # consume join message
        websocket.send_text("{not-json")
        websocket.send_json({"type": "chat", "message": "still connected"})
        message = websocket.receive_json()

    assert message["type"] == "chat"
    assert message["message"] == "still connected"


def test_websocket_sanitizes_chat_and_milestone_payloads(client: TestClient):
    with client.websocket_connect("/ws/community") as websocket:
        websocket.receive_json() # consume join
        websocket.send_json({"type": "chat", "message": "  hello world  "})
        chat = websocket.receive_json()
        websocket.send_json({"type": "milestone", "milestone": "  saved energy  ", "xp": 999999})
        milestone = websocket.receive_json()

    assert chat["message"] == "hello world"
    assert milestone["milestone"] == "saved energy"
    assert milestone["xp"] == 1000


def test_websocket_ignores_empty_or_whitespace_messages(client: TestClient):
    with client.websocket_connect("/ws/community") as websocket:
        websocket.receive_json() # consume join
        
        # Send empty chat
        websocket.send_json({"type": "chat", "message": "   "})
        
        # Send a valid message to ensure connection is alive and check we only receive this one
        websocket.send_json({"type": "chat", "message": "valid"})
        msg = websocket.receive_json()
        
        # We should receive the "valid" message, not the empty one
        assert msg["message"] == "valid"


def test_websocket_truncates_oversized_messages(client: TestClient):
    huge_msg = "A" * 600
    with client.websocket_connect("/ws/community") as websocket:
        websocket.receive_json() # consume join
        websocket.send_json({"type": "chat", "message": huge_msg})
        msg = websocket.receive_json()
        
    assert len(msg["message"]) == 500
    assert msg["message"] == huge_msg[:500]


def test_websocket_handles_xss_payload_without_crashing(client: TestClient):
    xss_payload = "<script>alert('xss')</script>"
    with client.websocket_connect("/ws/community") as websocket:
        websocket.receive_json() # consume join
        websocket.send_json({"type": "chat", "message": xss_payload})
        msg = websocket.receive_json()
        
    assert msg["message"] == xss_payload # Text remains raw but doesn't crash the server


def test_websocket_rapid_messages_stability(client: TestClient):
    with client.websocket_connect("/ws/community") as websocket:
        websocket.receive_json() # consume join
        # Send 30 messages rapidly
        for i in range(30):
            websocket.send_json({"type": "chat", "message": f"msg {i}"})
            
        # Verify we can read them back successfully without server dropping the socket
        for i in range(30):
            msg = websocket.receive_json()
            assert msg["type"] == "chat"
            assert msg["message"] == f"msg {i}"
