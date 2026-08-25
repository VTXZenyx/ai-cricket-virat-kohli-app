import asyncio

import mlx_whisper

from app.config import settings


def _transcribe_sync(audio_path: str) -> dict:
    result = mlx_whisper.transcribe(
    audio_path,
    path_or_hf_repo=settings.whisper_model,
    verbose=False,
    language="en",
    initial_prompt=(
        "This is a conversation with AI Virat Kohli. "
        "Common terms include Virat, Virat Kohli, cricket, batting, "
        "RCB, India, pressure, training, fitness, wickets and runs."
    ),
)

    return {
        "text": result.get("text", "").strip(),
        "language": result.get("language"),
    }


async def transcribe_audio(audio_path: str) -> dict:
    return await asyncio.to_thread(
        _transcribe_sync,
        audio_path,
    )