from io import BytesIO

from app.config import settings


def elevenlabs_ready() -> bool:
    return bool(settings.elevenlabs_api_key and settings.elevenlabs_voice_id)


def synthesize(text: str) -> bytes | None:
    if not elevenlabs_ready():
        return None

    from elevenlabs.client import ElevenLabs

    client = ElevenLabs(api_key=settings.elevenlabs_api_key)
    audio = client.text_to_speech.convert(
        voice_id=settings.elevenlabs_voice_id,
        model_id=settings.elevenlabs_model_id,
        output_format="mp3_44100_128",
        text=text,
    )

    # SDK responses are iterable byte chunks.
    buffer = BytesIO()
    for chunk in audio:
        if chunk:
            buffer.write(chunk)
    return buffer.getvalue()
