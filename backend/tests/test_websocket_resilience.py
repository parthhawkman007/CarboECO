from fastapi.testclient import TestClient


def test_websocket_ignores_invalid_json_and_continues(client: TestClient):
    with client.websocket_connect("/ws/community") as websocket:
        websocket.receive_json()
        websocket.send_text("{not-json")
        websocket.send_json({"type": "chat", "message": "still connected"})
        message = websocket.receive_json()

    assert message["type"] == "chat"
    assert message["message"] == "still connected"


def test_websocket_sanitizes_chat_and_milestone_payloads(client: TestClient):
    with client.websocket_connect("/ws/community") as websocket:
        websocket.receive_json()
        websocket.send_json({"type": "chat", "message": "  hello world  "})
        chat = websocket.receive_json()
        websocket.send_json({"type": "milestone", "milestone": "  saved energy  ", "xp": 999999})
        milestone = websocket.receive_json()

    assert chat["message"] == "hello world"
    assert milestone["milestone"] == "saved energy"
    assert milestone["xp"] == 1000
