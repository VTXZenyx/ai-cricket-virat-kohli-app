import re
from typing import Any

from app.config import settings


STOP_WORDS = {
    "the", "and", "that", "this", "with", "from", "have", "what", "when", "where",
    "your", "you", "about", "into", "want", "need", "just", "like", "really", "been",
    "feel", "feeling", "today", "tomorrow", "would", "could", "should", "than", "then",
}


def _keywords(text: str) -> set[str]:
    words = re.findall(r"[a-zA-Z][a-zA-Z-]{2,}", text.lower())
    return {word for word in words if word not in STOP_WORDS}


def _score(record: dict[str, Any], query_words: set[str]) -> float:
    fields = " ".join(
        str(record.get(key) or "")
        for key in ("topic", "subtopic", "content", "tags")
    ).lower()
    score = sum(1.0 for word in query_words if word in fields)
    score += float(record.get("confidence") or 0) * 0.08
    if record.get("is_verified"):
        score += 0.7
    return score


async def retrieve_knowledge(message: str, limit: int = 5) -> list[dict[str, Any]]:
    """Phase-1 retrieval: loads approved records and ranks them locally.

    This deliberately avoids vector search until pgvector/embeddings are added later.
    If Supabase is not configured, it simply returns no context.
    """
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return []

    from supabase import create_client

    client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    response = (
        client.table("virat_knowledge")
        .select("id,source_id,topic,subtopic,knowledge_type,content,quote_text,is_verified,confidence,tags")
        .eq("approved", True)
        .limit(200)
        .execute()
    )
    rows = list(response.data or [])
    if not rows:
        return []

    query_words = _keywords(message)
    ranked = sorted(rows, key=lambda row: _score(row, query_words), reverse=True)
    positive = [row for row in ranked if _score(row, query_words) > 0]
    return (positive or ranked)[:limit]


def format_context(records: list[dict[str, Any]]) -> str:
    if not records:
        return ""

    blocks: list[str] = []
    for index, row in enumerate(records, start=1):
        label = f"{row.get('topic', 'general')} / {row.get('subtopic') or 'general'}"
        content = str(row.get("content") or "").strip()
        quote = str(row.get("quote_text") or "").strip()
        quote_note = ""
        if row.get("knowledge_type") == "quote" and quote and row.get("is_verified"):
            quote_note = f"\nVerified direct quote: {quote}"
        blocks.append(
            f"[{index}] {label}\n"
            f"Type: {row.get('knowledge_type', 'summary')} | Verified: {bool(row.get('is_verified'))}\n"
            f"Knowledge: {content}{quote_note}"
        )

    return "\n\n".join(blocks)
