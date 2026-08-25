from dataclasses import dataclass
import os

from dotenv import load_dotenv

load_dotenv()


def _csv(name: str, default: str) -> list[str]:
    raw = os.getenv(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    # AI provider
    ai_provider: str = os.getenv(
        "AI_PROVIDER",
        "ollama",
    ).strip().lower()

    # Ollama
    ollama_base_url: str = os.getenv(
        "OLLAMA_BASE_URL",
        "http://127.0.0.1:11434",
    ).rstrip("/")

    ollama_model: str = os.getenv(
        "OLLAMA_MODEL",
        "qwen3:8b",
    )

    # OpenAI - optional later
    openai_api_key: str | None = os.getenv(
        "OPENAI_API_KEY"
    ) or None

    openai_model: str = os.getenv(
        "OPENAI_MODEL",
        "gpt-5.6-terra",
    )

    # Tavus - later
    tavus_api_key: str | None = os.getenv(
        "TAVUS_API_KEY"
    ) or None

    tavus_persona_id: str | None = os.getenv(
        "TAVUS_PERSONA_ID"
    ) or None

    tavus_replica_id: str | None = os.getenv(
        "TAVUS_REPLICA_ID"
    ) or None

    # ElevenLabs - later
    elevenlabs_api_key: str | None = os.getenv(
        "ELEVENLABS_API_KEY"
    ) or None

    elevenlabs_voice_id: str | None = os.getenv(
        "ELEVENLABS_VOICE_ID"
    ) or None

    elevenlabs_model_id: str = os.getenv(
        "ELEVENLABS_MODEL_ID",
        "eleven_flash_v2_5",
    )
    
    # Whisper speech-to-text
    whisper_model: str = os.getenv(
        "WHISPER_MODEL",
        "mlx-community/whisper-small-mlx",
    )

    # Fish Audio
    fish_audio_api_key: str | None = os.getenv(
        "FISH_AUDIO_API_KEY"
    ) or None

    fish_audio_reference_id: str | None = os.getenv(
        "FISH_AUDIO_REFERENCE_ID"
    ) or None

    fish_audio_model: str = os.getenv(
        "FISH_AUDIO_MODEL",
        "s2.1-pro-free",
    )

    # Whisper speech-to-text
    whisper_model: str = os.getenv(
        "WHISPER_MODEL",
        "mlx-community/whisper-small-mlx",
    )
    
    # Supabase
    supabase_url: str | None = os.getenv(
        "SUPABASE_URL"
    ) or None

    supabase_service_role_key: str | None = os.getenv(
        "SUPABASE_SERVICE_ROLE_KEY"
    ) or None

    # Frontend access
    cors_origins: list[str] = None  # type: ignore[assignment]

    def __post_init__(self):
        object.__setattr__(
            self,
            "cors_origins",
            _csv(
                "CORS_ORIGINS",
                "http://localhost:3000",
            ),
        )


settings = Settings()