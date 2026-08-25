from fastapi import APIRouter

from app.config import settings
from app.services.knowledge_service import retrieve_knowledge

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


@router.get("/status")
def knowledge_status() -> dict:
    return {
        "configured": bool(settings.supabase_url and settings.supabase_service_role_key),
        "table": "virat_knowledge",
        "retrieval": "phase-1-keyword-ranking",
    }


@router.get("/search")
async def knowledge_search(q: str) -> dict:
    rows = await retrieve_knowledge(q, limit=8)
    return {"count": len(rows), "results": rows}
