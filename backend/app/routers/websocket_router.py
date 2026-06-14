from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from jose import jwt, JWTError
from app.config import settings
from app.models import User, UserProfile
import json
import logging
import time

logger = logging.getLogger("carboeco")
router = APIRouter()

# Temporary ticket cache mapping: ticket_hex -> (user_id, expires_at)
ws_tickets: dict[str, tuple[int, float]] = {}

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")

    async def broadcast(self, message: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting to connection: {e}")
                self.disconnect(connection)

manager = ConnectionManager()

def sanitize_ws_text(value: object, max_length: int = 500) -> str:
    if not isinstance(value, str):
        return ""
    return value.strip()[:max_length]

@router.websocket("/ws/community")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(None),
    ticket: str = Query(None),
    db: Session = Depends(get_db)
):
    user = None
    current_time = time.time()
    
    # 1. Ticket validation (preferred for security)
    if ticket:
        # Prune expired tickets
        expired = [t for t, v in ws_tickets.items() if v[1] < current_time]
        for t in expired:
            ws_tickets.pop(t, None)
            
        if ticket in ws_tickets:
            uid, exp_at = ws_tickets.pop(ticket)
            if exp_at >= current_time:
                user = db.query(User).filter(User.id == uid).first()
                
    # 2. Token fallback (backwards compatibility for tests)
    if not user and token:
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            email: str = payload.get("sub")
            if email:
                user = db.query(User).filter(User.email == email).first()
        except JWTError:
            pass

    if not user:
        username = f"EcoGuest_{id(websocket) % 1000}"
    else:
        profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
        username = profile.full_name if (profile and profile.full_name) else user.email.split("@")[0].capitalize()

    await manager.connect(websocket)
    
    try:
        # Broadcast user joining event
        await manager.broadcast({
            "type": "user_join",
            "user": username,
            "message": f"{username} has joined the community sync."
        })

        while True:
            # Keep connection alive and listen for client messages
            data = await websocket.receive_text()
            try:
                message_data = json.loads(data)
                # Clients can broadcast custom messages, e.g. chat or eco milestones
                if message_data.get("type") == "chat":
                    message = sanitize_ws_text(message_data.get("message"))
                    if message:
                        await manager.broadcast({
                            "type": "chat",
                            "user": username,
                            "message": message
                        })
                elif message_data.get("type") == "milestone":
                    milestone = sanitize_ws_text(message_data.get("milestone"), max_length=120)
                    try:
                        xp = max(0, min(int(message_data.get("xp", 10)), 1000))
                    except (TypeError, ValueError):
                        xp = 10
                    await manager.broadcast({
                        "type": "milestone",
                        "user": username,
                        "milestone": milestone,
                        "xp": xp
                    })
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast({
            "type": "user_leave",
            "user": username,
            "message": f"{username} has left the community sync."
        })
