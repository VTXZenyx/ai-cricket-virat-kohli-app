from fastapi import APIRouter, HTTPException

from app.schemas import ChatRequest, ChatResponse
from app.services.openai_service import generate_reply

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def chat(payload: ChatRequest) -> ChatResponse:
    try:
        reply, provider, knowledge_used = await generate_reply(payload.message, payload.history)
        return ChatResponse(reply=reply, provider=provider, knowledge_used=knowledge_used)  # type: ignore[arg-type]
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI service error: {exc}") from exc
