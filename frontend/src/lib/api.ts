export type Role = "user" | "assistant";
export type ChatTurn = { role: Role; content: string };
export type ChatReply = { reply: string; provider: "openai" | "demo"; knowledge_used?: number };
export type CallMode = "voice" | "video";
export type CallSession = { mode: CallMode; demo: boolean; conversation_id: string | null; conversation_url: string | null; message: string | null };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

async function readError(res: Response): Promise<string> {
  try { const body = await res.json(); return body.detail || body.message || `Request failed (${res.status})`; }
  catch { return `Request failed (${res.status})`; }
}

export async function sendChat(message: string, history: ChatTurn[]): Promise<ChatReply> {
  const res = await fetch(`${API_BASE}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, history }) });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function startCall(mode: CallMode): Promise<CallSession> {
  const res = await fetch(`${API_BASE}/api/calls/session`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode }) });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function endCall(conversationId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/calls/${encodeURIComponent(conversationId)}/end`, { method: "POST" });
  if (!res.ok) throw new Error(await readError(res));
}

export async function requestSpeech(text: string): Promise<{ audioUrl?: string; demo: boolean }> {
  const res = await fetch(`${API_BASE}/api/tts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
  if (!res.ok) throw new Error(await readError(res));
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("audio/")) { const blob = await res.blob(); return { audioUrl: URL.createObjectURL(blob), demo: false }; }
  return { demo: true };
}
