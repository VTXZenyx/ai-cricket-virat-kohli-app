import httpx

from app.config import settings


FISH_TTS_URL = "https://api.fish.audio/v1/tts"


async def synthesize_speech(text: str) -> bytes:
    if not settings.fish_audio_api_key:
        raise RuntimeError("FISH_AUDIO_API_KEY is not configured.")

    if not settings.fish_audio_reference_id:
        raise RuntimeError("FISH_AUDIO_REFERENCE_ID is not configured.")

    clean_text = text.strip()

    if not clean_text:
        raise ValueError("Text cannot be empty.")

    headers = {
        "Authorization": f"Bearer {settings.fish_audio_api_key}",
        "Content-Type": "application/json",
        "model": settings.fish_audio_model,
    }

    payload = {
        "text": clean_text,
        "reference_id": settings.fish_audio_reference_id,
        "format": "mp3",
        "latency": "balanced",
        "normalize": True,
        "prosody": {
            "speed": 1.0,
            "volume": 0,
            "normalize_loudness": True,
        },
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            FISH_TTS_URL,
            headers=headers,
            json=payload,
        )

        response.raise_for_status()

    return response.content