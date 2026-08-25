import uuid
import httpx

from app.config import settings

TAVUS_BASE = "https://tavusapi.com/v2"


def tavus_ready(mode: str) -> bool:
    if not settings.tavus_api_key or not settings.tavus_persona_id:
        return False
    if mode == "video" and not settings.tavus_replica_id:
        return False
    return True


async def create_conversation(mode: str) -> dict:
    if not tavus_ready(mode):
        return {
            "mode": mode,
            "demo": True,
            "conversation_id": f"demo-{uuid.uuid4().hex[:10]}",
            "conversation_url": None,
            "message": "Demo call started. Add Tavus credentials in backend/.env for a real session.",
        }

    payload: dict = {
        "persona_id": settings.tavus_persona_id,
        "audio_only": mode == "voice",
        "conversation_name": f"AI Virat Kohli {mode.title()} Session",
        "custom_greeting": "Hey. You're in. Tell me what we're working on today.",
        "max_participants": 2,
    }

    if settings.tavus_replica_id:
        payload["replica_id"] = settings.tavus_replica_id

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{TAVUS_BASE}/conversations",
            headers={"Content-Type": "application/json", "x-api-key": settings.tavus_api_key},
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    return {
        "mode": mode,
        "demo": False,
        "conversation_id": data.get("conversation_id"),
        "conversation_url": data.get("conversation_url"),
        "message": None,
    }


async def end_conversation(conversation_id: str) -> None:
    if conversation_id.startswith("demo-") or not settings.tavus_api_key:
        return

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            f"{TAVUS_BASE}/conversations/{conversation_id}/end",
            headers={"x-api-key": settings.tavus_api_key},
        )
        response.raise_for_status()
