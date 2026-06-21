from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.config import settings
from app.models import User, UserProfile
from app.services.cache import CacheService
import json
import logging
import time
import asyncio

logger = logging.getLogger("carboeco")
router = APIRouter()

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
    ticket: str = Query(None),
    db: AsyncSession = Depends(get_db)
):
    user = None
    
    # 1. Ticket validation (preferred for security)
    if ticket:
        uid = await CacheService.get(f"ws_ticket:{ticket}")
        if uid:
            await CacheService.invalidate(f"ws_ticket:{ticket}")
            stmt = select(User).where(User.id == int(uid))
            res = await db.execute(stmt)
            user = res.scalar_one_or_none()

    if not user:
        username = f"EcoGuest_{id(websocket) % 1000}"
    else:
        stmt = select(UserProfile).where(UserProfile.user_id == user.id)
        res = await db.execute(stmt)
        profile = res.scalar_one_or_none()
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
            data = await websocket.receive_text()
            try:
                message_data = json.loads(data)
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
