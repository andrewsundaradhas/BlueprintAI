"use client";

import * as React from "react";

const PHASES = [
  "Laying out rooms…",
  "Placing walls…",
  "Cutting openings…",
  "Labeling…",
  "Validating…",
];

export function LoadingWireframe({ phase = 0 }: { phase?: number }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
      <svg width="480" height="320" viewBox="0 0 480 320" style={{ overflow: "visible" }}>
        {/* Plot rectangle */}
        <rect
          x="20" y="20" width="440" height="280"
          fill="none" stroke="rgb(var(--accent))" strokeWidth="1.5"
          strokeDasharray="1440" strokeDashoffset="1440"
          style={{ animation: "draw-line 1s var(--ease-out) forwards" }}
        />
        {/* Interior walls — drawn one at a time */}
        <line x1="240" y1="20" x2="240" y2="160" stroke="rgb(var(--accent))" strokeWidth="1.5"
              strokeDasharray="140" strokeDashoffset="140"
              style={{ animation: "draw-line 0.4s var(--ease-out) 1s forwards" }} />
        <line x1="20" y1="160" x2="460" y2="160" stroke="rgb(var(--accent))" strokeWidth="1.5"
              strokeDasharray="440" strokeDashoffset="440"
              style={{ animation: "draw-line 0.6s var(--ease-out) 1.2s forwards" }} />
        <line x1="160" y1="160" x2="160" y2="300" stroke="rgb(var(--accent))" strokeWidth="1.5"
              strokeDasharray="140" strokeDashoffset="140"
              style={{ animation: "draw-line 0.4s var(--ease-out) 1.6s forwards" }} />
        <line x1="320" y1="160" x2="320" y2="300" stroke="rgb(var(--accent))" strokeWidth="1.5"
              strokeDasharray="140" strokeDashoffset="140"
              style={{ animation: "draw-line 0.4s var(--ease-out) 1.8s forwards" }} />
        {/* Door arc */}
        <path d="M 100 160 A 30 30 0 0 1 130 190" fill="none" stroke="rgb(var(--accent))" strokeWidth="1.5"
              opacity="0" style={{ animation: "fade-in 0.4s var(--ease-out) 2.4s forwards" }} />
        {/* Window */}
        <line x1="80" y1="20" x2="160" y2="20" stroke="rgb(var(--accent))" strokeWidth="2.5"
              opacity="0" style={{ animation: "fade-in 0.4s var(--ease-out) 2.6s forwards" }} />
        {/* Room labels */}
        <text x="130" y="100" fill="rgb(var(--accent))" fontFamily="var(--font-mono)" fontSize="10" opacity="0"
              style={{ animation: "fade-in 0.3s var(--ease-out) 2.8s forwards" }}>LIVING</text>
        <text x="350" y="100" fill="rgb(var(--accent))" fontFamily="var(--font-mono)" fontSize="10" opacity="0"
              style={{ animation: "fade-in 0.3s var(--ease-out) 3.0s forwards" }}>KITCHEN</text>
        <text x="80"  y="240" fill="rgb(var(--accent))" fontFamily="var(--font-mono)" fontSize="10" opacity="0"
              style={{ animation: "fade-in 0.3s var(--ease-out) 3.2s forwards" }}>BEDROOM</text>
        <text x="230" y="240" fill="rgb(var(--accent))" fontFamily="var(--font-mono)" fontSize="10" opacity="0"
              style={{ animation: "fade-in 0.3s var(--ease-out) 3.4s forwards" }}>BATH</text>
        <text x="380" y="240" fill="rgb(var(--accent))" fontFamily="var(--font-mono)" fontSize="10" opacity="0"
              style={{ animation: "fade-in 0.3s var(--ease-out) 3.6s forwards" }}>BR 2</text>
      </svg>
      <div className="mt-8 mono text-xs text-secondary tracking-wide">
        {PHASES[phase] ?? "Generating plan…"}
      </div>
    </div>
  );
}
