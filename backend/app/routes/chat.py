import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.schemas import ChatRequest, ChatResponse
from app.services.openai_service import (
    generate_reply,
    prepare_streaming_reply,
)

router = APIRouter(
    prefix="/api/chat",
    tags=["chat"],
)


@router.post(
    "",
    response_model=ChatResponse,
)
async def chat(
    payload: ChatRequest,
) -> ChatResponse:
    """
    Completed-response endpoint.

    Kept for the voice pipeline.
    """

    try:
        reply, provider, knowledge_used = (
            await generate_reply(
                payload.message,
                payload.history,
            )
        )

        return ChatResponse(
            reply=reply,
            provider=provider,
            knowledge_used=knowledge_used,
        )  # type: ignore[arg-type]

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"AI service error: {exc}",
        ) from exc


@router.post("/stream")
async def chat_stream(
    payload: ChatRequest,
) -> StreamingResponse:
    """
    Streaming endpoint for the normal text chatbot.

    Uses newline-delimited JSON (NDJSON) so the browser
    can receive Qwen output incrementally.
    """

    try:
        stream, provider, knowledge_used = (
            await prepare_streaming_reply(
                payload.message,
                payload.history,
            )
        )

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"AI service error: {exc}",
        ) from exc

    async def event_stream():
        # Send metadata first.
        yield (
            json.dumps(
                {
                    "type": "meta",
                    "provider": provider,
                    "knowledge_used": knowledge_used,
                }
            )
            + "\n"
        )

        try:
            async for chunk in stream:
                yield (
                    json.dumps(
                        {
                            "type": "token",
                            "content": chunk,
                        }
                    )
                    + "\n"
                )

            yield (
                json.dumps(
                    {
                        "type": "done",
                    }
                )
                + "\n"
            )

        except Exception as exc:
            yield (
                json.dumps(
                    {
                        "type": "error",
                        "detail": str(exc),
                    }
                )
                + "\n"
            )

    return StreamingResponse(
        event_stream(),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )