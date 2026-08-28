import json
from collections.abc import AsyncIterator

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

    instructions += (
        "\n\nRESPONSE LENGTH AND SPEED\n"
        "- Answer the user's actual question immediately.\n"
        "- Normal conversational replies should usually be 30 to 55 words.\n"
        "- Use 2 to 3 sentences for normal replies.\n"
        "- Hard maximum of about 70 words unless the user explicitly asks for detail.\n"
        "- Finish the thought naturally. Do not stop halfway through a sentence.\n"
        "- Do not repeat the same motivational point in different words.\n"
        "- Prefer one strong, practical point over a long speech.\n"
        "- Ask at most one short follow-up question when it genuinely helps.\n"
        "- Give longer answers only when the user asks for explanation, detail, a plan, or multiple points.\n"
    )

    return instructions


def _build_messages(
    message: str,
    history: list[ChatTurn],
    instructions: str,
) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = [
        {
            "role": "system",
            "content": instructions,
        }
    ]

    # Keep roughly the latest 3 user/assistant exchanges.
    for turn in history[-6:]:
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

    return messages


def _ollama_payload(
    messages: list[dict[str, str]],
    *,
    stream: bool,
) -> dict:
    return {
        "model": settings.ollama_model,
        "messages": messages,
        "stream": stream,
        "think": False,

        # Prevent the expensive cold start between normal conversations.
        "keep_alive": "30m",

        "options": {
            "temperature": 0.5,
            "top_p": 0.85,
            "repeat_penalty": 1.10,

            # Enough room to finish naturally.
            # The system prompt controls normal reply length.
            "num_predict": 120,
        },
    }


async def _generate_with_ollama(
    message: str,
    history: list[ChatTurn],
    instructions: str,
) -> str:
    """
    Existing completed-response path.

    Keep this for voice calls because Fish Audio currently
    expects the complete AI response before generating audio.
    """

    messages = _build_messages(
        message=message,
        history=history,
        instructions=instructions,
    )

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{settings.ollama_base_url}/api/chat",
            json=_ollama_payload(
                messages,
                stream=False,
            ),
        )

        response.raise_for_status()
        data = response.json()

    return (
        data.get("message", {})
        .get("content", "")
        .strip()
    )


async def _stream_with_ollama(
    message: str,
    history: list[ChatTurn],
    instructions: str,
) -> AsyncIterator[str]:
    """
    Streaming path used by the normal text chatbot.
    Yields text as Ollama generates it.
    """

    messages = _build_messages(
        message=message,
        history=history,
        instructions=instructions,
    )

    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream(
            "POST",
            f"{settings.ollama_base_url}/api/chat",
            json=_ollama_payload(
                messages,
                stream=True,
            ),
        ) as response:
            response.raise_for_status()

            async for line in response.aiter_lines():
                if not line:
                    continue

                data = json.loads(line)

                content = (
                    data.get("message", {})
                    .get("content", "")
                )

                if content:
                    yield content

                if data.get("done"):
                    break


async def prepare_streaming_reply(
    message: str,
    history: list[ChatTurn],
) -> tuple[AsyncIterator[str], str, int]:
    """
    Prepares knowledge/persona before the HTTP response begins.

    Returns:
        stream,
        provider,
        number of knowledge records used
    """

    records = await retrieve_knowledge(message)

    context = format_context(records)

    instructions = _build_instructions(context)

    if settings.ai_provider == "ollama":
        stream = _stream_with_ollama(
            message=message,
            history=history,
            instructions=instructions,
        )

        return (
            stream,
            "ollama",
            len(records),
        )

    async def demo_stream() -> AsyncIterator[str]:
        yield _demo_reply(message)

    return (
        demo_stream(),
        "demo",
        len(records),
    )


async def generate_reply(
    message: str,
    history: list[ChatTurn],
) -> tuple[str, str, int]:
    """
    Existing non-streaming response.

    This remains available for the voice-call pipeline.
    """

    records = await retrieve_knowledge(message)

    context = format_context(records)

    instructions = _build_instructions(context)

    if settings.ai_provider == "ollama":
        reply = await _generate_with_ollama(
            message=message,
            history=history,
            instructions=instructions,
        )

        if reply:
            return (
                reply,
                "ollama",
                len(records),
            )

    return (
        _demo_reply(message),
        "demo",
        len(records),
    )