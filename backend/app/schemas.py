from typing import Literal

from pydantic import BaseModel, Field


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(
        min_length=1,
        max_length=12000,
    )


class ChatRequest(BaseModel):
    message: str = Field(
        min_length=1,
        max_length=8000,
    )

    history: list[ChatTurn] = Field(
        default_factory=list
    )

    # Lets the backend tune responses differently
    # for normal text chat versus voice calls.
    channel: Literal["text", "voice"] = "text"


class ChatResponse(BaseModel):
    reply: str

    provider: Literal[
        "openai",
        "ollama",
        "demo",
    ]

    knowledge_used: int = 0


class CallRequest(BaseModel):
    mode: Literal[
        "voice",
        "video",
    ]


class CallResponse(BaseModel):
    mode: Literal[
        "voice",
        "video",
    ]

    demo: bool

    conversation_id: str | None = None
    conversation_url: str | None = None
    message: str | None = None


class TTSRequest(BaseModel):
    text: str = Field(
        min_length=1,
        max_length=5000,
    )