import httpx

from app.config import settings
from app.persona import MENTOR_INSTRUCTIONS
from app.schemas import ChatTurn
from app.services.knowledge_service import (
    format_context,
    retrieve_knowledge,
)


def _demo_reply(message: str) -> str:
    return (
        "Come with intent. Tell me what you want to improve, "
        "what is getting in the way, and what standard you want to hold yourself to."
    )


def _build_instructions(context: str) -> str:
    instructions = MENTOR_INSTRUCTIONS

    if context:
        instructions += (
            "\n\nPUBLIC VIRAT KOHLI KNOWLEDGE CONTEXT\n"
            "Use this material only when relevant. "
            "Do not invent facts beyond the supplied context.\n\n"
            + context
        )

    return instructions


async def _generate_with_ollama(
    message: str,
    history: list[ChatTurn],
    instructions: str,
) -> str:

    messages = [
        {
            "role": "system",
            "content": instructions,
        }
    ]

    for turn in history[-12:]:
        messages.append(
            {
                "role": turn.role,
                "content": turn.content,
            }
        )

    messages.append(
        {
            "role": "user",
            "content": message,
        }
    )

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{settings.ollama_base_url}/api/chat",
            json={
                "model": settings.ollama_model,
                "messages": messages,
                "stream": False,
                "think": False,
                "options": {
                "temperature": 0.6,
                   "top_p": 0.88,
                        "repeat_penalty": 1.12,
                    "num_predict": 260,
                    },
            },
        )

        response.raise_for_status()
        data = response.json()

    return (
        data.get("message", {})
        .get("content", "")
        .strip()
    )


async def generate_reply(
    message: str,
    history: list[ChatTurn],
) -> tuple[str, str, int]:

    records = await retrieve_knowledge(message)

    context = format_context(records)

    instructions = _build_instructions(context)

    if settings.ai_provider == "ollama":
        reply = await _generate_with_ollama(
            message,
            history,
            instructions,
        )

        if reply:
            return reply, "ollama", len(records)

    return _demo_reply(message), "demo", len(records)