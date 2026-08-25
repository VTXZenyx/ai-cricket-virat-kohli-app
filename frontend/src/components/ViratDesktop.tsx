"use client";

import { FormEvent, PointerEvent, useRef, useState } from "react";
import { CricketBall } from "./CricketBall";
import { ChatExperience } from "./ChatExperience";
import { CallModal } from "./CallModal";
import { CallMode, CallSession, startCall } from "@/lib/api";

type Mode = "message" | "voice" | "video";

const modes: Record<Mode, { kicker: string; desc: string; button: string }> = {
  message: { kicker: "message mode", desc: "Type first. Keep it quick, direct and personal.", button: "■ Start message" },
  voice: { kicker: "voice call mode", desc: "Talk in real time. This is where tone, energy and presence matter.", button: "■ Answer voice call" },
  video: { kicker: "video call mode", desc: "Face-to-face mentor mode. This is where your Tavus avatar session appears.", button: "■ Enter video call" },
};

export function ViratDesktop() {
  const [mode, setMode] = useState<Mode>("message");
  const [visible, setVisible] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const [view, setView] = useState<"home" | "chat">("home");
  const [prompt, setPrompt] = useState("");
  const [input, setInput] = useState("");
  const [callSession, setCallSession] = useState<CallSession | null>(null);
  const [callLoading, setCallLoading] = useState<CallMode | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const drag = useRef({ active: false, startX: 0, startY: 0, baseX: 0, baseY: 0 });

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    drag.current = { active: true, startX: event.clientX, startY: event.clientY, baseX: position.x, baseY: position.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current.active) return;
    setPosition({ x: drag.current.baseX + (event.clientX - drag.current.startX), y: drag.current.baseY + (event.clientY - drag.current.startY) });
  }

  function stopDrag() { drag.current.active = false; }

  async function openCall(callMode: CallMode) {
    if (callLoading) return;
    setCallLoading(callMode);
    try {
      setCallSession(await startCall(callMode));
    } finally {
      setCallLoading(null);
    }
  }

  function answer() {
    if (mode === "message") {
      setPrompt(input.trim());
      setView("chat");
      return;
    }
    void openCall(mode);
  }

  function submitMessage(event: FormEvent) {
    event.preventDefault();
    if (!input.trim()) return;
    setMode("message");
    setPrompt(input.trim());
    setView("chat");
  }

  return (
    <div className="desktop">
      <div className="topbar">
        <div className="brand"><span className="brand-mark">18</span><em>AI Virat Kohli</em><span>// fan-made prototype</span></div>
        <div className="live"><i /><span>mentor online</span></div>
      </div>

      <main className="hero">
        <div className="jersey-ghost">18</div>
        <h1>Meet AI<br />Virat Kohli!!!<span>Bring the aura.</span></h1>
        <p className="hero-copy"><strong>Cricket first. Confidence always.</strong> Message, call or video chat with a fan-made Virat Kohli-inspired AI mentor built around competition, discipline, fitness and a winning mindset.</p>
        <div className="slogan">Set the standard.<br /><b>Chase hard.</b><br />Own the moment.</div>

        {visible && !minimized && (
          <div className="window-shell" style={{ transform: `translateX(-50%) translate(${position.x}px, ${position.y}px)` }}>
            <section className="retro-window">
              <div className="titlebar" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag}>
                <span className="title-led" /><strong>AI VIRAT KOHLI</strong><span className="title-fill" />
                <button className="winbtn" onClick={() => setMinimized(true)} aria-label="Minimize">—</button>
                <button className="winbtn" onClick={() => setVisible(false)} aria-label="Close">×</button>
              </div>

              {view === "home" ? (
                <div className="window-content">
                  <div className="stage"><CricketBall /></div>
                  <div className="panel">
                    <div className="call-kicker">{modes[mode].kicker}</div>
                    <h2><span>Virat Kohli</span><br />is calling you.</h2>
                    <p>{modes[mode].desc}</p>
                    <div className="mode-tabs">
                      <button className={`mode ${mode === "message" ? "active" : ""}`} onClick={() => setMode("message")}>Message</button>
                      <button className={`mode ${mode === "voice" ? "active" : ""}`} data-mode="voice" onClick={() => setMode("voice")}>Voice</button>
                      <button className={`mode ${mode === "video" ? "active" : ""}`} data-mode="video" onClick={() => setMode("video")}>Video</button>
                    </div>
                    <button className="answer" onClick={answer} disabled={!!callLoading}>{callLoading ? "CONNECTING…" : modes[mode].button}</button>
                    <form className="message-box" onSubmit={submitMessage}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Say something with intent…" /><button>↗</button></form>
                    <div className="chips">
                      {["Set my game-day mindset", "Push me harder today", "Help me raise my standards", "Give me the discipline to stay consistent"].map((text) => <button key={text} onClick={() => setInput(text)}>{text.replace("Help me ", "").replace("Give me the discipline to ", "").replace(" today", "")}</button>)}
                    </div>
                    <p className="disclaimer">Fan-made AI experience inspired by Virat Kohli&apos;s publicly known cricket mindset. Not affiliated with or endorsed by Virat Kohli.</p>
                  </div>
                </div>
              ) : (
                <ChatExperience initialPrompt={prompt} onBack={() => { setView("home"); setPrompt(""); }} onVoice={() => void openCall("voice")} onVideo={() => void openCall("video")} />
              )}
            </section>
          </div>
        )}

        <button className="desktop-icon" onClick={() => { setVisible(true); setMinimized(false); }}><span className="icon-ball" /><span>AI Virat Kohli</span></button>
      </main>

      <div className="taskbar"><button className="taskbtn" onClick={() => { setVisible(true); setMinimized(false); }}><i /><span>AI Virat Kohli</span></button></div>
      {callSession && <CallModal session={callSession} onClose={() => setCallSession(null)} />}
    </div>
  );
}
