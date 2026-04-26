"use client";

import * as React from "react";
import type { Opening, SolvedPlan, SolvedRoom } from "@/lib/solver/solver";

type Props = {
  plan: SolvedPlan;
  selectedId: string | null;
  onSelect: (room: SolvedRoom) => void;
  showGrid?: boolean;
  showDimensions?: boolean;
};

export function FloorPlanSVG({
  plan,
  selectedId,
  onSelect,
  showGrid = true,
  showDimensions = true,
}: Props) {
  const { plot, rooms, openings, TE = 230 } = plan;
  const plotW = plot.w;
  const plotH = plot.h;
  const pad = 800;
  const viewW = plotW + pad * 2;
  const viewH = plotH + pad * 2;
  const ox = pad;
  const oy = pad;
  const T = (x: number, y: number) => [ox + x, oy + y] as const;

  const interiorWalls = React.useMemo(() => {
    const walls: { kind: "v" | "h"; x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        const a = rooms[i]!;
        const b = rooms[j]!;
        if (Math.abs(a.x + a.w - b.x) < 200 || Math.abs(b.x + b.w - a.x) < 200) {
          const x =
            Math.abs(a.x + a.w - b.x) < 200
              ? (a.x + a.w + b.x) / 2
              : (a.x + b.x + b.w) / 2;
          const y1 = Math.max(a.y, b.y);
          const y2 = Math.min(a.y + a.h, b.y + b.h);
          if (y2 > y1) walls.push({ kind: "v", x1: x, y1, x2: x, y2 });
        }
        if (Math.abs(a.y + a.h - b.y) < 200 || Math.abs(b.y + b.h - a.y) < 200) {
          const y =
            Math.abs(a.y + a.h - b.y) < 200
              ? (a.y + a.h + b.y) / 2
              : (a.y + b.y + b.h) / 2;
          const x1 = Math.max(a.x, b.x);
          const x2 = Math.min(a.x + a.w, b.x + b.w);
          if (x2 > x1) walls.push({ kind: "h", x1, y1: y, x2, y2: y });
        }
      }
    }
    return walls;
  }, [rooms]);

  return (
    <svg className="canvas" viewBox={`0 0 ${viewW} ${viewH}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block", width: "100%", height: "100%" }}>
      <defs>
        <pattern id="bp-grid-minor" width="100" height="100" patternUnits="userSpaceOnUse">
          <path d="M 100 0 L 0 0 0 100" fill="none" stroke="var(--canvas-grid-minor)" strokeWidth="1" />
        </pattern>
        <pattern id="bp-grid-major" width="1000" height="1000" patternUnits="userSpaceOnUse">
          <path d="M 1000 0 L 0 0 0 1000" fill="none" stroke="var(--canvas-grid-major)" strokeWidth="1.5" />
        </pattern>
      </defs>

      {showGrid && <rect x="0" y="0" width={viewW} height={viewH} fill="url(#bp-grid-minor)" />}
      {showGrid && <rect x="0" y="0" width={viewW} height={viewH} fill="url(#bp-grid-major)" />}

      <rect
        x={ox - 50} y={oy - 50}
        width={plotW + 100} height={plotH + 100}
        fill="none" stroke="rgb(var(--fg-primary))" strokeOpacity="0.3"
        strokeWidth="1.5" strokeDasharray="2 4"
      />

      {showDimensions && (
        <g>
          <PlotDim x1={ox} y1={oy - 350} x2={ox + plotW} y2={oy - 350} label={`${plotW.toLocaleString()} mm`} />
          <PlotDim x1={ox - 350} y1={oy} x2={ox - 350} y2={oy + plotH} label={`${plotH.toLocaleString()} mm`} vertical />
        </g>
      )}

      {/* Room fills */}
      {rooms.map((r) => {
        const [x, y] = T(r.x, r.y);
        const isSel = selectedId === r.id;
        return (
          <rect
            key={`fill-${r.id}`}
            x={x} y={y}
            width={r.w} height={r.h}
            fill={isSel ? "rgba(45,127,249,0.16)" : "var(--canvas-room-fill)"}
            onClick={() => onSelect(r)}
            style={{ cursor: "pointer", pointerEvents: "all" }}
          />
        );
      })}

      {/* Exterior walls */}
      <rect
        x={ox + TE / 2} y={oy + TE / 2}
        width={plotW - TE} height={plotH - TE}
        fill="none" stroke="rgb(var(--canvas-wall))" strokeWidth="6" strokeLinecap="square"
      />

      {/* Interior walls */}
      {interiorWalls.map((w, i) => {
        const [x1, y1] = T(w.x1, w.y1);
        const [x2, y2] = T(w.x2, w.y2);
        return (
          <line
            key={i}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="rgb(var(--canvas-wall))" strokeWidth="3" strokeLinecap="square" fill="none"
          />
        );
      })}

      {/* Openings */}
      {openings.map((op) => (
        <OpeningGlyph key={op.id} op={op} T={T} />
      ))}

      {/* Fixtures — drawn inside each room */}
      {rooms.map((r) => (
        <RoomFixtures key={`fx-${r.id}`} room={r} T={T} />
      ))}

      {/* Room labels — auto-sized with optional 2-line wrap */}
      {rooms.map((r) => {
        const [x, y] = T(r.x, r.y);
        const upper = r.name.toUpperCase();
        const innerPad = 250;
        const maxH = Math.max(500, r.h - innerPad * 2);
        const charPx = 0.58;
        const widthCap = (r.w * 0.85) / Math.max(1, upper.length * charPx);
        const heightCap = maxH * 0.32;
        let fs = Math.min(widthCap, heightCap, 360);
        let lines: string[] = [upper];
        if (upper.includes(" ")) {
          const words = upper.split(" ");
          let best = { fs, lines: [upper] };
          for (let i = 1; i < words.length; i++) {
            const a = words.slice(0, i).join(" ");
            const b = words.slice(i).join(" ");
            const widest = Math.max(a.length, b.length);
            const wFs = (r.w * 0.85) / Math.max(1, widest * charPx);
            const hFs = (maxH * 0.42) / 2;
            const lineFs = Math.min(wFs, hFs, 320);
            if (lineFs > best.fs * 1.05) best = { fs: lineFs, lines: [a, b] };
          }
          fs = best.fs;
          lines = best.lines;
        }
        fs = Math.max(100, fs);
        const areaFs = Math.max(90, Math.min(fs * 0.55, 220));
        const cx = x + r.w / 2;
        const cy = y + r.h / 2;
        const lh = fs * 1.05;
        const blockH = lh * lines.length;
        const startY = cy - blockH / 2 + fs * 0.85;
        return (
          <g key={`lbl-${r.id}`} pointerEvents="none">
            {lines.map((ln, i) => (
              <text
                key={i}
                x={cx} y={startY + i * lh}
                fill="rgb(var(--fg-primary))"
                fontFamily="var(--font-display)"
                fontWeight="500"
                style={{ fontSize: fs, letterSpacing: "0.04em" }}
                textAnchor="middle"
              >
                {ln}
              </text>
            ))}
            <text
              x={cx} y={cy + blockH / 2 + areaFs * 1.2}
              fill="rgb(var(--fg-tertiary))"
              fontFamily="var(--font-mono)"
              style={{ fontSize: areaFs }}
              textAnchor="middle"
            >
              {(r.actualArea ?? (r.w * r.h) / 1e6).toFixed(1)} sqm
            </text>
          </g>
        );
      })}

      {/* Selection */}
      {(() => {
        const r = rooms.find((rm) => rm.id === selectedId);
        if (!r) return null;
        const [x, y] = T(r.x, r.y);
        const margin = 30;
        const handles: [number, number][] = [
          [x - margin, y - margin],
          [x + r.w / 2, y - margin],
          [x + r.w + margin, y - margin],
          [x - margin, y + r.h / 2],
          [x + r.w + margin, y + r.h / 2],
          [x - margin, y + r.h + margin],
          [x + r.w / 2, y + r.h + margin],
          [x + r.w + margin, y + r.h + margin],
        ];
        return (
          <g pointerEvents="none">
            <rect
              x={x - margin} y={y - margin}
              width={r.w + margin * 2} height={r.h + margin * 2}
              fill="none" stroke="rgb(var(--accent))" strokeWidth="2"
            />
            {handles.map(([hx, hy], i) => (
              <rect
                key={i} x={hx - 60} y={hy - 60}
                width={120} height={120}
                fill="var(--bg-canvas)" stroke="rgb(var(--accent))" strokeWidth="1"
              />
            ))}
            <DimEdge x1={x} y1={y + r.h + 280} x2={x + r.w} y2={y + r.h + 280} label={`${Math.round(r.w)} mm`} />
          </g>
        );
      })()}
    </svg>
  );
}

// ────────── Fixtures (per-room furniture rendered in SVG) ──────────

type FixturePrimitive =
  | { kind: "rect"; x: number; y: number; w: number; h: number; label?: string; rounded?: boolean; fill?: string }
  | { kind: "circle"; cx: number; cy: number; r: number; label?: string; fill?: string };

function fixturesFor(name: string, w: number, h: number): FixturePrimitive[] {
  const n = name.toLowerCase();
  const out: FixturePrimitive[] = [];

  // Bathroom / Toilet
  if (/(bath|toilet|wc|powder)/.test(n)) {
    // WC against bottom wall
    out.push({ kind: "rect", x: 100, y: h - 600, w: 500, h: 500, label: "WC", rounded: true });
    // Washbasin against top wall
    out.push({ kind: "rect", x: w - 700, y: 100, w: 600, h: 400, label: "WB", rounded: true });
    // Shower square in opposite corner (only if bath, not powder)
    if (!/powder/.test(n) && w > 1500 && h > 1500) {
      out.push({ kind: "rect", x: w - 900, y: h - 900, w: 800, h: 800, label: "SH", fill: "rgba(120,140,170,0.15)" });
    }
    return out;
  }

  // Kitchen
  if (/kitchen/.test(n)) {
    // L-shaped counter along top + left
    out.push({ kind: "rect", x: 100, y: 100, w: w - 200, h: 600, label: "" });
    if (h > 2200) out.push({ kind: "rect", x: 100, y: 700, w: 600, h: h - 800, label: "" });
    out.push({ kind: "rect", x: 200, y: 250, w: 700, h: 300, label: "Stove", fill: "rgba(15,15,20,0.45)" });
    out.push({ kind: "rect", x: w - 1000, y: 250, w: 700, h: 300, label: "Sink", fill: "rgba(80,100,140,0.30)" });
    if (h > 2500) out.push({ kind: "rect", x: w - 800, y: h - 700, w: 600, h: 600, label: "Fridge", fill: "rgba(220,220,225,0.20)" });
    return out;
  }
  if (/kitchenette/.test(n)) {
    out.push({ kind: "rect", x: 100, y: 100, w: w - 200, h: 600, label: "" });
    out.push({ kind: "rect", x: 200, y: 250, w: 600, h: 300, label: "Stove", fill: "rgba(15,15,20,0.45)" });
    return out;
  }

  // Master / Bedroom
  if (/master/.test(n)) {
    const bedW = Math.min(1800, w - 800);
    const bedH = Math.min(2000, h - 800);
    out.push({ kind: "rect", x: (w - bedW) / 2, y: 400, w: bedW, h: bedH, label: "King", rounded: true });
    if (w > 3000) out.push({ kind: "rect", x: 100, y: h - 700, w: 1800, h: 600, label: "Wardrobe", fill: "rgba(110,80,55,0.25)" });
    return out;
  }
  if (/bedroom|\bbr ?\d|guest/.test(n) && !/master/.test(n)) {
    const bedW = Math.min(1500, w - 800);
    const bedH = Math.min(2000, h - 800);
    out.push({ kind: "rect", x: (w - bedW) / 2, y: 400, w: bedW, h: bedH, label: "Bed", rounded: true });
    if (w > 2800) out.push({ kind: "rect", x: 100, y: h - 700, w: 1500, h: 600, label: "Wardrobe", fill: "rgba(110,80,55,0.25)" });
    return out;
  }

  // Studio
  if (/studio/.test(n)) {
    const bedW = Math.min(1500, w - 1500);
    out.push({ kind: "rect", x: 200, y: 200, w: bedW, h: 2000, label: "Bed", rounded: true });
    out.push({ kind: "rect", x: w - 2300, y: h - 1000, w: 2100, h: 800, label: "Sofa", rounded: true, fill: "rgba(120,40,40,0.30)" });
    return out;
  }

  // Living / Dining
  if (/living|dining|hall|lounge/.test(n)) {
    // Sofa along longer side
    const horizontal = w >= h;
    if (horizontal) {
      out.push({ kind: "rect", x: 400, y: h - 1100, w: 2100, h: 900, label: "Sofa", rounded: true, fill: "rgba(120,40,40,0.30)" });
      out.push({ kind: "rect", x: w - 1700, y: 200, w: 1500, h: 400, label: "TV unit", fill: "rgba(15,15,20,0.45)" });
      if (w > 5000) {
        out.push({ kind: "rect", x: w - 2400, y: h - 1500, w: 1800, h: 1000, label: "Dining", rounded: true, fill: "rgba(110,80,55,0.30)" });
      }
    } else {
      out.push({ kind: "rect", x: 200, y: 400, w: 900, h: 2100, label: "Sofa", rounded: true, fill: "rgba(120,40,40,0.30)" });
      out.push({ kind: "rect", x: w - 600, y: 400, w: 400, h: 1500, label: "TV", fill: "rgba(15,15,20,0.45)" });
    }
    return out;
  }

  // Puja
  if (/(puja|pooja|prayer|mandir)/.test(n)) {
    out.push({ kind: "rect", x: w / 2 - 400, y: h - 800, w: 800, h: 600, label: "Mandir", fill: "rgba(250,200,80,0.25)" });
    return out;
  }

  // Study / Home Office
  if (/study|office|workspace/.test(n)) {
    out.push({ kind: "rect", x: 200, y: 200, w: 1200, h: 600, label: "Desk", fill: "rgba(110,80,55,0.30)" });
    if (h > 2200) out.push({ kind: "rect", x: 200, y: h - 700, w: 1500, h: 400, label: "Bookshelf", fill: "rgba(110,80,55,0.20)" });
    return out;
  }

  // Utility / Store
  if (/utility/.test(n)) {
    out.push({ kind: "rect", x: 200, y: 200, w: 800, h: 700, label: "Washer", fill: "rgba(220,220,225,0.20)" });
    if (h > 2000) out.push({ kind: "rect", x: w - 1000, y: 200, w: 800, h: 700, label: "Dryer", fill: "rgba(220,220,225,0.20)" });
    return out;
  }
  if (/store/.test(n)) {
    out.push({ kind: "rect", x: 100, y: 100, w: 600, h: h - 200, label: "Shelves", fill: "rgba(110,80,55,0.25)" });
    return out;
  }

  // Balcony — nothing
  return out;
}

function RoomFixtures({ room, T }: { room: SolvedRoom; T: (x: number, y: number) => readonly [number, number] }) {
  const items = fixturesFor(room.name, room.w, room.h);
  if (!items.length) return null;
  const [ox, oy] = T(room.x, room.y);
  // Cap label size: read at any zoom, but not overwhelming on small fixtures
  return (
    <g transform={`translate(${ox} ${oy})`} pointerEvents="none">
      {items.map((it, i) => {
        if (it.kind === "rect") {
          return (
            <g key={i}>
              <rect
                x={it.x} y={it.y}
                width={it.w} height={it.h}
                fill={it.fill ?? "rgba(120,140,170,0.10)"}
                stroke="rgb(var(--canvas-wall))"
                strokeOpacity="0.55"
                strokeWidth="20"
                rx={it.rounded ? 60 : 0}
              />
              {it.label && it.w > 500 && it.h > 350 && (
                <text
                  x={it.x + it.w / 2}
                  y={it.y + it.h / 2 + 50}
                  fill="rgba(255,255,255,0.55)"
                  fontFamily="var(--font-mono)"
                  fontSize={Math.min(180, it.h / 2.4)}
                  textAnchor="middle"
                >
                  {it.label.toUpperCase()}
                </text>
              )}
            </g>
          );
        }
        return null;
      })}
    </g>
  );
}

function OpeningGlyph({ op, T }: { op: Opening; T: (x: number, y: number) => readonly [number, number] }) {
  const [x, y] = T(op.x, op.y);
  const w = op.w;
  const h = op.h;
  if (op.type === "door") {
    if (op.dir === "v") {
      const r = h;
      const startX = op.swing === "in-right" ? x + w : x;
      const startY = op.swing === "in-right" ? y : y + h;
      const endX = op.swing === "in-right" ? x + w + r : x + r;
      const endY = op.swing === "in-right" ? y + r : y;
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} fill="var(--bg-canvas)" />
          <path d={`M ${startX} ${startY} A ${r} ${r} 0 0 1 ${endX} ${endY}`} fill="none" stroke="rgb(var(--canvas-wall))" strokeWidth="1.5" />
          <line x1={startX} y1={startY} x2={endX} y2={endY} stroke="rgb(var(--canvas-wall))" strokeWidth="1.5" />
        </g>
      );
    }
    const r = w;
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} fill="var(--bg-canvas)" />
        <path d={`M ${x + w} ${y + h} A ${r} ${r} 0 0 1 ${x + w} ${y + h + r}`} fill="none" stroke="rgb(var(--canvas-wall))" strokeWidth="1.5" />
        <line x1={x + w} y1={y + h} x2={x + w} y2={y + h + r} stroke="rgb(var(--canvas-wall))" strokeWidth="1.5" />
      </g>
    );
  }
  if (op.type === "window") {
    const inset = (op.dir === "h" ? h : w) * 0.2;
    if (op.dir === "h") {
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} fill="var(--bg-canvas)" />
          <line x1={x} y1={y + inset} x2={x + w} y2={y + inset} stroke="rgb(var(--canvas-wall))" strokeWidth="1.5" />
          <line x1={x} y1={y + h - inset} x2={x + w} y2={y + h - inset} stroke="rgb(var(--canvas-wall))" strokeWidth="1.5" />
          <line x1={x} y1={y} x2={x} y2={y + h} stroke="rgb(var(--canvas-wall))" strokeWidth="1.5" />
          <line x1={x + w} y1={y} x2={x + w} y2={y + h} stroke="rgb(var(--canvas-wall))" strokeWidth="1.5" />
        </g>
      );
    }
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} fill="var(--bg-canvas)" />
        <line x1={x + inset} y1={y} x2={x + inset} y2={y + h} stroke="rgb(var(--canvas-wall))" strokeWidth="1.5" />
        <line x1={x + w - inset} y1={y} x2={x + w - inset} y2={y + h} stroke="rgb(var(--canvas-wall))" strokeWidth="1.5" />
        <line x1={x} y1={y} x2={x + w} y2={y} stroke="rgb(var(--canvas-wall))" strokeWidth="1.5" />
        <line x1={x} y1={y + h} x2={x + w} y2={y + h} stroke="rgb(var(--canvas-wall))" strokeWidth="1.5" />
      </g>
    );
  }
  return null;
}

function PlotDim({ x1, y1, x2, y2, label, vertical = false }: { x1: number; y1: number; x2: number; y2: number; label: string; vertical?: boolean }) {
  if (vertical) {
    return (
      <g>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgb(var(--canvas-dimension))" strokeWidth="1" />
        <line x1={x1 - 60} y1={y1} x2={x1 + 60} y2={y1} stroke="rgb(var(--canvas-dimension))" strokeWidth="1" />
        <line x1={x2 - 60} y1={y2} x2={x2 + 60} y2={y2} stroke="rgb(var(--canvas-dimension))" strokeWidth="1" />
        <text
          x={x1 - 80} y={(y1 + y2) / 2}
          fill="rgb(var(--canvas-dimension))" fontFamily="var(--font-mono)" fontSize="280"
          transform={`rotate(-90 ${x1 - 80} ${(y1 + y2) / 2})`}
          textAnchor="middle"
        >{label}</text>
      </g>
    );
  }
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgb(var(--canvas-dimension))" strokeWidth="1" />
      <line x1={x1} y1={y1 - 60} x2={x1} y2={y1 + 60} stroke="rgb(var(--canvas-dimension))" strokeWidth="1" />
      <line x1={x2} y1={y1 - 60} x2={x2} y2={y1 + 60} stroke="rgb(var(--canvas-dimension))" strokeWidth="1" />
      <text x={(x1 + x2) / 2} y={y1 - 80} fill="rgb(var(--canvas-dimension))" fontFamily="var(--font-mono)" fontSize="280" textAnchor="middle">{label}</text>
    </g>
  );
}

function DimEdge({ x1, y1, x2, y2, label }: { x1: number; y1: number; x2: number; y2: number; label: string }) {
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgb(var(--canvas-dimension))" strokeWidth="1" />
      <line x1={x1 - 30} y1={y1 - 30} x2={x1 + 30} y2={y1 + 30} stroke="rgb(var(--accent))" strokeWidth="2" />
      <line x1={x2 - 30} y1={y2 - 30} x2={x2 + 30} y2={y2 + 30} stroke="rgb(var(--accent))" strokeWidth="2" />
      <rect x={(x1 + x2) / 2 - 700} y={y1 - 220} width="1400" height="320" fill="var(--bg-canvas)" />
      <text x={(x1 + x2) / 2} y={y1 + 30} fill="rgb(var(--accent))" fontSize="280" fontFamily="var(--font-mono)" textAnchor="middle" fontWeight="500">{label}</text>
    </g>
  );
}
