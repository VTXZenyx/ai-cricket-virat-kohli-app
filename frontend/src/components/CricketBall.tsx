"use client";

import { CSSProperties, PointerEvent, useRef, useState } from "react";

export function CricketBall() {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [impact, setImpact] = useState(false);
  const timerRef = useRef<number | null>(null);

  function hit() {
    setImpact(false);
    window.requestAnimationFrame(() => setImpact(true));
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setImpact(false), 720);
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: y * -11, y: x * 14 });
  }

  return (
    <div className={`ball-stage ${impact ? "impact" : ""}`} onPointerMove={move} onPointerLeave={() => setTilt({ x: 0, y: 0 })} onDoubleClick={hit}>
      <div className="stadium-lights"><span className="lamp" /><span className="lamp" /></div>
      <div className="ball-scene">
        <div className="ball-trail" />
        <div className="ball-halo" />
        <div className="ball-tilt" style={{ "--rx": `${tilt.x}deg`, "--ry": `${tilt.y}deg` } as CSSProperties}>
          <div className="ball-float">
            <svg className="cricket-ball" viewBox="0 0 320 320" aria-label="Animated cricket ball made with code">
              <defs>
                <radialGradient id="leather" cx="34%" cy="27%" r="76%">
                  <stop offset="0%" stopColor="#F05A60" />
                  <stop offset="16%" stopColor="#D33640" />
                  <stop offset="45%" stopColor="#B91F2D" />
                  <stop offset="74%" stopColor="#861421" />
                  <stop offset="100%" stopColor="#4B0811" />
                </radialGradient>
                <radialGradient id="spec" cx="32%" cy="23%" r="45%">
                  <stop offset="0%" stopColor="#fff" stopOpacity=".62" />
                  <stop offset="22%" stopColor="#ffe8e8" stopOpacity=".18" />
                  <stop offset="100%" stopColor="#fff" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="seam" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#fff8ea" />
                  <stop offset=".52" stopColor="#e8d8c5" />
                  <stop offset="1" stopColor="#bca795" />
                </linearGradient>
                <filter id="texture" x="-25%" y="-25%" width="150%" height="150%">
                  <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="4" seed="18" result="noise" />
                  <feColorMatrix in="noise" type="saturate" values="0" result="mono" />
                  <feComponentTransfer in="mono" result="soft"><feFuncA type="table" tableValues="0 .22" /></feComponentTransfer>
                  <feBlend in="SourceGraphic" in2="soft" mode="soft-light" />
                </filter>
                <clipPath id="clip"><circle cx="160" cy="160" r="128" /></clipPath>
              </defs>
              <circle cx="160" cy="160" r="128" fill="url(#leather)" />
              <g clipPath="url(#clip)" filter="url(#texture)">
                <circle cx="160" cy="160" r="128" fill="url(#leather)" />
                <ellipse cx="122" cy="105" rx="106" ry="86" fill="url(#spec)" opacity=".7" />
                <path d="M73 58 C126 91 107 229 250 265" fill="none" stroke="#5B0B14" strokeOpacity=".5" strokeWidth="18" strokeLinecap="round" />
                <path d="M73 58 C126 91 107 229 250 265" fill="none" stroke="url(#seam)" strokeWidth="8" strokeLinecap="round" />
                <path d="M66 63 C118 98 99 236 243 273" fill="none" stroke="#F3E7D6" strokeOpacity=".92" strokeWidth="3.5" strokeDasharray="2 9" strokeLinecap="round" />
                <path d="M80 52 C133 84 116 221 257 257" fill="none" stroke="#E8D8C5" strokeOpacity=".86" strokeWidth="3.5" strokeDasharray="2 9" strokeLinecap="round" />
                <path d="M44 118 C70 62 117 36 165 34" fill="none" stroke="#fff" strokeOpacity=".09" strokeWidth="10" strokeLinecap="round" />
              </g>
              <circle cx="160" cy="160" r="127" fill="none" stroke="#FF7A7F" strokeOpacity=".18" strokeWidth="2" />
            </svg>
          </div>
        </div>
        <div className="ball-floor" />
        <div className="scene-flash" />
      </div>
      <button type="button" className="ball-impact-button" onClick={hit}>Tap ball</button>
      <div className="number18">18</div>
      <div className="stage-label">night cricket<br />kohli intensity<br />premium AI mentor</div>
    </div>
  );
}
