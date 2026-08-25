from fastapi import APIRouter, HTTPException, Response

from app.schemas import TTSRequest
from app.services.fish_audio_service import synthesize_speech

router = APIRouter(prefix="/api/tts", tags=["tts"])


@router.post("")
async def tts(payload: TTSRequest):
    try:
        audio = await synthesize_speech(payload.text)

        return Response(
            content=audio,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": 'inline; filename="voice.mp3"',
            },
        )

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Fish Audio voice service error: {exc}",
        ) from exc
        