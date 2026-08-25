import os
import tempfile

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.services.whisper_service import transcribe_audio


router = APIRouter(
    prefix="/api/stt",
    tags=["stt"],
)


@router.post("")
async def speech_to_text(
    audio: UploadFile = File(...),
):
    suffix = os.path.splitext(
        audio.filename or "recording.webm"
    )[1]

    if not suffix:
        suffix = ".webm"

    temp_path = None

    try:
        audio_bytes = await audio.read()

        if not audio_bytes:
            raise HTTPException(
                status_code=400,
                detail="Audio file is empty.",
            )

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=suffix,
        ) as temp_file:
            temp_file.write(audio_bytes)
            temp_path = temp_file.name

        result = await transcribe_audio(temp_path)

        if not result["text"]:
            raise HTTPException(
                status_code=422,
                detail="No speech was detected.",
            )

        return {
            "text": result["text"],
            "language": result["language"],
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Speech-to-text error: {exc}",
        ) from exc

    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)