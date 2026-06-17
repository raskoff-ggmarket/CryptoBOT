import asyncio
import json
import logging
from typing import Optional
from fastapi import WebSocket
from collections import defaultdict

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        # user_id -> list of WebSocket connections
        self._user_connections: dict[int, list[WebSocket]] = defaultdict(list)
        # channel -> set of user_ids subscribed
        self._channel_subscribers: dict[str, set[int]] = defaultdict(set)
        # websocket -> user_id
        self._ws_user: dict[WebSocket, int] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self._user_connections[user_id].append(websocket)
        self._ws_user[websocket] = user_id
        # Auto-subscribe to user's global channel
        self._channel_subscribers[f"user:{user_id}"].add(user_id)
        logger.info(f"WS connected: user={user_id}")

    def disconnect(self, websocket: WebSocket):
        user_id = self._ws_user.pop(websocket, None)
        if user_id is not None:
            conns = self._user_connections.get(user_id, [])
            if websocket in conns:
                conns.remove(websocket)
            if not conns:
                del self._user_connections[user_id]
        logger.info(f"WS disconnected: user={user_id}")

    def subscribe(self, websocket: WebSocket, channel: str):
        user_id = self._ws_user.get(websocket)
        if user_id is not None:
            self._channel_subscribers[channel].add(user_id)

    def unsubscribe(self, websocket: WebSocket, channel: str):
        user_id = self._ws_user.get(websocket)
        if user_id is not None:
            self._channel_subscribers[channel].discard(user_id)

    async def send_to_user(self, user_id: int, message: dict):
        conns = self._user_connections.get(user_id, [])
        dead = []
        for ws in conns:
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    async def broadcast_to_channel(self, channel: str, message: dict):
        user_ids = self._channel_subscribers.get(channel, set())
        tasks = [self.send_to_user(uid, message) for uid in user_ids]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def emit_bot_update(self, bot_id: int, event_type: str, data: dict):
        await self.broadcast_to_channel(f"bot:{bot_id}", {
            "type": event_type,
            "bot_id": bot_id,
            "data": data,
        })

    async def emit_deal_opened(self, bot_id: int, deal_data: dict):
        await self.emit_bot_update(bot_id, "bot.deal_opened", deal_data)

    async def emit_deal_closed(self, bot_id: int, deal_data: dict):
        await self.emit_bot_update(bot_id, "bot.deal_closed", deal_data)

    async def emit_deal_updated(self, bot_id: int, deal_data: dict):
        await self.emit_bot_update(bot_id, "bot.deal_updated", deal_data)

    async def emit_bot_error(self, bot_id: int, user_id: int, error_code: str, message: str, deal_id: Optional[int] = None):
        await self.emit_bot_update(bot_id, "bot.error", {
            "error_code": error_code,
            "message": message,
            "deal_id": deal_id,
        })
        await self.send_to_user(user_id, {
            "type": "system.notification",
            "data": {"level": "error", "message": message},
        })

    async def emit_risk_limit(self, user_id: int, data: dict):
        await self.send_to_user(user_id, {
            "type": "risk.limit_reached",
            "data": data,
        })

    async def emit_backtest_progress(self, user_id: int, run_id: int, progress_pct: float, current_date: str, deals_simulated: int):
        await self.send_to_user(user_id, {
            "type": "backtest.progress",
            "run_id": run_id,
            "data": {
                "progress_pct": progress_pct,
                "current_date": current_date,
                "deals_simulated": deals_simulated,
            },
        })

    async def emit_backtest_completed(self, user_id: int, run_id: int, summary: dict):
        await self.send_to_user(user_id, {
            "type": "backtest.completed",
            "run_id": run_id,
            "data": summary,
        })

    def get_active_connections_count(self) -> int:
        return sum(len(v) for v in self._user_connections.values())


ws_manager = ConnectionManager()
