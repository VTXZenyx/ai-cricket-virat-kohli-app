"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ChatTurn, requestSpeech, sendChat } from "@/lib/api";

const starters = [
  "Set my game-day mindset",
  "Push me harder today",
  "Help me raise my standards",
  "Give me the discipline to stay consistent",
];

type Props = {
  initialPrompt?: string;
  onBack: () => void;
  onVoice: () => void;
  onVideo: () => void;
};

export function ChatExperience({ initialPrompt = "", onBack, onVoice, onVideo }: Props) {
  const [messages, setMessages] = useState<ChatTurn[]>([
    { role: "assistant", content: "You're in. Tell me what we're working on today — your game, your standards, your confidence, or something outside cricket." },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [provider, setProvider] = useState<"openai" | "demo" | null>(null);
  const [knowledgeUsed, setKnowledgeUsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sentInitial = useRef(false);

  useEffect(() => {
    if (initialPrompt && !sentInitial.current) {
      sentInitial.current = true;
      void submit(initialPrompt);
    }
  }, [initialPrompt]);

  async function submit(raw?: string) {
    const message = (raw ?? input).trim();
    if (!message || sending) return;

    const history = messages.slice(-12);
    setMessages((current) => [...current, { role: "user", content: message }]);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const data = await sendChat(message, history);
      setMessages((current) => [...current, { role: "assistant", content: data.reply }]);
      setProvider(data.provider);
      setKnowledgeUsed(data.knowledge_used ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  async function speak(text: string) {
    try {
      if (audioRef.current) audioRef.current.pause();
      const result = await requestSpeech(text);
      if (result.audioUrl) {
        const audio = new Audio(result.audioUrl);
        audioRef.current = audio;
        await audio.play();
        return;
      }
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.98;
        utterance.pitch = 0.92;
        window.speechSynthesis.speak(utterance);
      }
    } catch {
      // Optional voice playback should never break text chat.
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void submit();
  }

  return (
    <div className="chat-view">
      <div className="chat-toolbar">
        <button type="button" onClick={onBack}>← Home</button>
        <div><strong>AI Virat Kohli</strong><span>fan-made AI mentor • online</span></div>
        <div className="chat-call-actions"><button onClick={onVoice}>Voice</button><button onClick={onVideo}>Video</button></div>
      </div>

      <div className="messages" aria-live="polite">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`message-row message-row--${message.role}`}>
            {message.role === "assistant" && <div className="message-avatar">18</div>}
            <div className={`bubble bubble--${message.role}`}>
              {message.content.split("\n").map((line, lineIndex) => <p key={lineIndex}>{line || <>&nbsp;</>}</p>)}
              {message.role === "assistant" && <button className="listen-button" onClick={() => speak(message.content)}>▶ Listen</button>}
            </div>
          </div>
        ))}
        {sending && <div className="message-row message-row--assistant"><div className="message-avatar">18</div><div className="bubble bubble--assistant typing"><span /><span /><span /></div></div>}
      </div>

      {messages.length <= 2 && <div className="starters">{starters.map((starter) => <button key={starter} onClick={() => submit(starter)}>{starter}</button>)}</div>}
      {error && <div className="error-banner">{error}</div>}

      <form className="composer" onSubmit={onSubmit}>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder="Say it with intent…"
          rows={1}
          aria-label="Message AI Virat Kohli"
        />
        <button type="submit" className="send-button" disabled={sending || !input.trim()} aria-label="Send message">↗</button>
      </form>
      <div className="chat-meta"><span>{provider === "openai" ? "OpenAI connected" : provider === "demo" ? "Demo AI mode" : "Ready"}</span><span>{knowledgeUsed > 0 ? `${knowledgeUsed} knowledge records used` : "Supabase context optional"}</span></div>
    </div>
  );
}
