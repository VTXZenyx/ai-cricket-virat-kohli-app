from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes import calls, chat, knowledge, stt, tts

app = FastAPI(
    title="AI Virat Kohli API",
    version="0.1.0",
    description="Phase 1 API for a fan-made Virat Kohli-inspired AI mentor prototype.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(calls.router)
app.include_router(tts.router)
app.include_router(stt.router)
app.include_router(knowledge.router)


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "openai_configured": bool(settings.openai_api_key),
        "tavus_configured": bool(
            settings.tavus_api_key and settings.tavus_persona_id
        ),
        "elevenlabs_configured": bool(
            settings.elevenlabs_api_key and settings.elevenlabs_voice_id
        ),
        "fish_audio_configured": bool(
            settings.fish_audio_api_key
            and settings.fish_audio_reference_id
        ),
        "whisper_configured": bool(settings.whisper_model),
        "supabase_configured": bool(
            settings.supabase_url
            and settings.supabase_service_role_key
        ),
    }