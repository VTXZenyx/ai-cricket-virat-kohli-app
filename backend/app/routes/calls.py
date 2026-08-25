from fastapi import APIRouter, HTTPException

from app.schemas import CallRequest, CallResponse
from app.services.tavus_service import create_conversation, end_conversation

router = APIRouter(prefix="/api/calls", tags=["calls"])


@router.post("/session", response_model=CallResponse)
async def start_session(payload: CallRequest) -> CallResponse:
    try:
        data = await create_conversation(payload.mode)
        return CallResponse(**data)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Tavus error: {exc}") from exc


@router.post("/{conversation_id}/end")
async def stop_session(conversation_id: str) -> dict[str, bool]:
    try:
        await end_conversation(conversation_id)
        return {"ok": True}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Unable to end Tavus session: {exc}") from exc
