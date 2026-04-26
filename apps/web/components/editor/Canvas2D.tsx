"use client";

import * as React from "react";
import { Stage, Layer, Line, Rect, Group, Text, Circle, Arc } from "react-konva";
import type Konva from "konva";
import { useProjectStore } from "@/lib/store/project";
import { type Floor, type Opening, type PlanIR, type Room, type Wall, WALL_THICKNESS_MM } from "@/lib/schema/plan";
import { polygonCentroid, polygonArea, sqftFromSqMm, sqmFromSqMm, mmToMeters, wallVector } from "@/lib/canvas/geometry";

const ROOM_COLORS: Record<string, string> = {
  bedroom:        "rgba(99, 102, 241, 0.10)",
  master_bedroom: "rgba(79, 70, 229, 0.13)",
  kids_bedroom:   "rgba(168, 85, 247, 0.11)",
  guest_bedroom:  "rgba(236, 72, 153, 0.10)",
  living:         "rgba(34, 197, 94, 0.10)",
  dining:         "rgba(132, 204, 22, 0.10)",
  kitchen:        "rgba(249, 115, 22, 0.10)",
  bathroom:       "rgba(14, 165, 233, 0.10)",
  toilet:         "rgba(14, 165, 233, 0.10)",
  balcony:        "rgba(45, 212, 191, 0.10)",
  utility:        "rgba(148, 163, 184, 0.12)",
  store:          "rgba(148, 163, 184, 0.12)",
  puja:           "rgba(250, 204, 21, 0.12)",
  study:          "rgba(168, 85, 247, 0.10)",
  corridor:       "rgba(148, 163, 184, 0.06)",
  staircase:      "rgba(148, 163, 184, 0.10)",
  lobby:          "rgba(148, 163, 184, 0.08)",
  garage:         "rgba(100, 116, 139, 0.10)",
  open_terrace:   "rgba(34, 197, 94, 0.06)",
};

const ROOM_OUTLINES: Record<string, string> = {
  bedroom:        "#6366f1",
  master_bedroom: "#4f46e5",
  kids_bedroom:   "#a855f7",
  guest_bedroom:  "#ec4899",
  living:         "#22c55e",
  dining:         "#84cc16",
  kitchen:        "#f97316",
  bathroom:       "#0ea5e9",
  toilet:         "#0ea5e9",
  balcony:        "#2dd4bf",
  utility:        "#94a3b8",
  store:          "#94a3b8",
  puja:           "#facc15",
  study:          "#a855f7",
  corridor:       "#94a3b8",
  staircase:      "#94a3b8",
  lobby:          "#94a3b8",
  garage:         "#64748b",
  open_terrace:   "#22c55e",
};

type Size = { w: number; h: number };

export function Canvas2D() {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const stageRef = React.useRef<Konva.Stage | null>(null);
  const [size, setSize] = React.useState<Size>({ w: 800, h: 600 });
  const [scale, setScale] = React.useState(0.06); // px per mm
  const [pan, setPan] = React.useState({ x: 40, y: 40 });
  const plan = useProjectStore((s) => s.plan);
  const showGrid = useProjectStore((s) => s.showGrid);
  const showDimensions = useProjectStore((s) => s.showDimensions);
  const selection = useProjectStore((s) => s.selection);
  const setSelection = useProjectStore((s) => s.setSelection);

  // Resize observer
  React.useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => {
      const r = containerRef.current!.getBoundingClientRect();
      setSize({ w: Math.max(200, r.width), h: Math.max(200, r.height) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Auto-fit on plan change
  React.useEffect(() => {
    if (!plan || size.w < 50) return;
    const pad = 60;
    const sx = (size.w - 2 * pad) / plan.meta.plot_width_mm;
    const sy = (size.h - 2 * pad) / plan.meta.plot_depth_mm;
    const s = Math.min(sx, sy);
    setScale(s);
    setPan({
      x: (size.w - plan.meta.plot_width_mm * s) / 2,
      y: (size.h - plan.meta.plot_depth_mm * s) / 2,
    });
  }, [plan?.meta.plot_width_mm, plan?.meta.plot_depth_mm, size.w, size.h]);

  // Wheel zoom
  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;
    const oldScale = scale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const mousePointTo = {
      x: (pointer.x - pan.x) / oldScale,
      y: (pointer.y - pan.y) / oldScale,
    };
    const direction = e.evt.deltaY > 0 ? 1 : -1;
    const factor = 1.1;
    const newScale = direction > 0 ? oldScale / factor : oldScale * factor;
    const clamped = Math.max(0.01, Math.min(2, newScale));
    setScale(clamped);
    setPan({
      x: pointer.x - mousePointTo.x * clamped,
      y: pointer.y - mousePointTo.y * clamped,
    });
  };

  // Background drag (pan)
  const onStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.target === e.target.getStage()) setSelection(null);
  };

  if (!plan) {
    return (
      <div ref={containerRef} className="w-full h-full grid place-items-center bg-muted/30">
        <p className="text-sm text-muted-foreground">No plan yet — generate one to begin.</p>
      </div>
    );
  }

  const floor = plan.floors[0]!;

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden bg-[hsl(var(--muted))]/40 relative">
      <Stage
        ref={stageRef as React.RefObject<Konva.Stage>}
        width={size.w}
        height={size.h}
        onWheel={onWheel}
        onMouseDown={onStageMouseDown}
        draggable
        x={pan.x}
        y={pan.y}
        onDragEnd={(e) => setPan({ x: e.target.x(), y: e.target.y() })}
        scaleX={scale}
        scaleY={scale}
      >
        {showGrid && (
          <Layer listening={false}>
            <GridLayer plan={plan} viewSize={size} pan={pan} scale={scale} />
          </Layer>
        )}
        <Layer listening={false}>
          <PlotOutline plan={plan} />
        </Layer>
        <Layer>
          {floor.rooms.map((r) => (
            <RoomShape
              key={r.id}
              room={r}
              selected={selection?.kind === "room" && selection.id === r.id}
              onClick={() => setSelection({ kind: "room", id: r.id })}
            />
          ))}
        </Layer>
        <Layer>
          {floor.walls.map((w) => (
            <WallShape
              key={w.id}
              wall={w}
              selected={selection?.kind === "wall" && selection.id === w.id}
              onClick={() => setSelection({ kind: "wall", id: w.id })}
            />
          ))}
        </Layer>
        <Layer>
          {floor.openings.map((o) => {
            const w = floor.walls.find((x) => x.id === o.wall_id);
            if (!w) return null;
            return (
              <OpeningShape
                key={o.id}
                opening={o}
                wall={w}
                selected={selection?.kind === "opening" && selection.id === o.id}
                onClick={() => setSelection({ kind: "opening", id: o.id })}
              />
            );
          })}
        </Layer>
        <Layer listening={false}>
          {floor.rooms.map((r) => (
            <FixtureLayer key={r.id} room={r} />
          ))}
        </Layer>
        {showDimensions && (
          <Layer listening={false}>
            <DimensionsLayer plan={plan} />
          </Layer>
        )}
      </Stage>
      <ScaleIndicator scale={scale} />
    </div>
  );
}

function GridLayer({ plan, viewSize, pan, scale }: { plan: PlanIR; viewSize: Size; pan: { x: number; y: number }; scale: number }) {
  const minor = 1000; // 1m
  const major = 5000; // 5m
  const lines: React.ReactNode[] = [];

  // Compute the bounds in plan-mm that's visible
  const xMin = -pan.x / scale - 1000;
  const xMax = (-pan.x + viewSize.w) / scale + 1000;
  const yMin = -pan.y / scale - 1000;
  const yMax = (-pan.y + viewSize.h) / scale + 1000;

  const extra = 5000;
  const startX = Math.floor((Math.max(0, xMin) - extra) / minor) * minor;
  const endX = Math.ceil((Math.min(plan.meta.plot_width_mm + extra, xMax)) / minor) * minor;
  const startY = Math.floor((Math.max(0, yMin) - extra) / minor) * minor;
  const endY = Math.ceil((Math.min(plan.meta.plot_depth_mm + extra, yMax)) / minor) * minor;

  for (let x = startX; x <= endX; x += minor) {
    const isMajor = x % major === 0;
    lines.push(
      <Line
        key={`vx${x}`}
        points={[x, startY, x, endY]}
        stroke={isMajor ? "rgba(120,140,170,0.35)" : "rgba(120,140,170,0.15)"}
        strokeWidth={isMajor ? 1 : 0.5}
        listening={false}
      />,
    );
  }
  for (let y = startY; y <= endY; y += minor) {
    const isMajor = y % major === 0;
    lines.push(
      <Line
        key={`hy${y}`}
        points={[startX, y, endX, y]}
        stroke={isMajor ? "rgba(120,140,170,0.35)" : "rgba(120,140,170,0.15)"}
        strokeWidth={isMajor ? 1 : 0.5}
        listening={false}
      />,
    );
  }
  return <>{lines}</>;
}

function PlotOutline({ plan }: { plan: PlanIR }) {
  return (
    <Rect
      x={0}
      y={0}
      width={plan.meta.plot_width_mm}
      height={plan.meta.plot_depth_mm}
      stroke="rgba(120,140,170,0.6)"
      dash={[160, 100]}
      strokeWidth={2}
      listening={false}
    />
  );
}

function RoomShape({ room, selected, onClick }: { room: Room; selected: boolean; onClick: () => void }) {
  const points = room.polygon.flatMap((p) => [p.x, p.y]);
  const fill = ROOM_COLORS[room.type] ?? "rgba(148, 163, 184, 0.08)";
  const stroke = selected ? "#3b82f6" : ROOM_OUTLINES[room.type] ?? "#94a3b8";
  const c = polygonCentroid(room.polygon);
  const areaSqMm = polygonArea(room.polygon);
  return (
    <Group>
      <Line
        points={points}
        closed
        fill={fill}
        stroke={stroke}
        strokeWidth={selected ? 30 : 0}
        opacity={selected ? 0.7 : 1}
        onClick={onClick}
        onTap={onClick}
      />
      <Group x={c.x} y={c.y} listening={false}>
        <Text
          text={room.name}
          fontSize={220}
          fontStyle="bold"
          fill={ROOM_OUTLINES[room.type] ?? "#475569"}
          align="center"
          x={-1500}
          width={3000}
          listening={false}
        />
        <Text
          text={`${sqmFromSqMm(areaSqMm)}  ·  ${sqftFromSqMm(areaSqMm)}`}
          fontSize={160}
          fill="#64748b"
          align="center"
          x={-2000}
          y={260}
          width={4000}
          listening={false}
        />
      </Group>
    </Group>
  );
}

function WallShape({ wall, selected, onClick }: { wall: Wall; selected: boolean; onClick: () => void }) {
  const thickness = WALL_THICKNESS_MM[wall.type];
  const stroke = selected ? "#3b82f6" : "#0f172a";
  return (
    <Line
      points={[wall.start.x, wall.start.y, wall.end.x, wall.end.y]}
      stroke={stroke}
      strokeWidth={thickness}
      lineCap="butt"
      onClick={onClick}
      onTap={onClick}
      hitStrokeWidth={Math.max(thickness, 200)}
    />
  );
}

function OpeningShape({ opening, wall, selected, onClick }: { opening: Opening; wall: Wall; selected: boolean; onClick: () => void }) {
  const { ux, uy, len } = wallVector(wall);
  const cx = wall.start.x + ux * opening.position_along_wall * len;
  const cy = wall.start.y + uy * opening.position_along_wall * len;
  const halfW = opening.width_mm / 2;
  const ax = cx - ux * halfW;
  const ay = cy - uy * halfW;
  const bx = cx + ux * halfW;
  const by = cy + uy * halfW;
  const t = WALL_THICKNESS_MM[wall.type];
  const px = -uy; // perpendicular
  const py = ux;

  const isDoor = opening.type.startsWith("door");
  const isWindow = opening.type.startsWith("window");
  const isVent = opening.type === "ventilator";

  const stroke = selected ? "#3b82f6" : isWindow ? "#0ea5e9" : isVent ? "#a855f7" : "#0f172a";
  const fill = "white";

  return (
    <Group onClick={onClick} onTap={onClick}>
      {/* Cut-out: plain white rectangle to "erase" the wall */}
      <Line
        points={[
          ax + (px * t) / 2,
          ay + (py * t) / 2,
          bx + (px * t) / 2,
          by + (py * t) / 2,
          bx - (px * t) / 2,
          by - (py * t) / 2,
          ax - (px * t) / 2,
          ay - (py * t) / 2,
        ]}
        closed
        fill={fill}
        stroke={stroke}
        strokeWidth={selected ? 40 : 20}
      />
      {isDoor && (
        <>
          {/* Hinge line (the door leaf) and quarter-arc */}
          <Line
            points={[ax, ay, ax + ux * opening.width_mm * 0.7 + px * opening.width_mm * 0.7, ay + uy * opening.width_mm * 0.7 + py * opening.width_mm * 0.7]}
            stroke={stroke}
            strokeWidth={30}
            opacity={0.6}
          />
          <Arc
            x={ax}
            y={ay}
            innerRadius={opening.width_mm * 0.7}
            outerRadius={opening.width_mm * 0.7}
            angle={90}
            rotation={(Math.atan2(uy, ux) * 180) / Math.PI - 90}
            stroke={stroke}
            strokeWidth={20}
            opacity={0.5}
          />
        </>
      )}
      {isWindow && (
        <Line
          points={[ax, ay, bx, by]}
          stroke={stroke}
          strokeWidth={40}
        />
      )}
      {isVent && (
        <Line
          points={[ax, ay, bx, by]}
          stroke={stroke}
          strokeWidth={30}
          dash={[60, 40]}
        />
      )}
    </Group>
  );
}

function FixtureLayer({ room }: { room: Room }) {
  return (
    <>
      {room.fixtures.map((f, i) => {
        const sz = fixtureSize(f.type);
        return (
          <Group key={`${room.id}-f-${i}`} x={f.position.x} y={f.position.y} rotation={f.rotation_deg}>
            <Rect
              x={-sz.w / 2}
              y={-sz.h / 2}
              width={sz.w}
              height={sz.h}
              fill="rgba(15, 23, 42, 0.06)"
              stroke="#475569"
              strokeWidth={20}
              cornerRadius={40}
            />
            <Text
              text={fixtureLabel(f.type)}
              fontSize={140}
              fill="#475569"
              x={-sz.w / 2}
              y={-50}
              width={sz.w}
              align="center"
              listening={false}
            />
          </Group>
        );
      })}
    </>
  );
}

function fixtureSize(type: string): { w: number; h: number } {
  switch (type) {
    case "bed_king":     return { w: 1800, h: 2000 };
    case "bed_double":   return { w: 1500, h: 2000 };
    case "bed_single":   return { w: 1000, h: 2000 };
    case "wardrobe":     return { w: 1800, h: 600 };
    case "sofa_3":       return { w: 2100, h: 900 };
    case "sofa_2":       return { w: 1500, h: 900 };
    case "dining_table_4": return { w: 1200, h: 900 };
    case "dining_table_6": return { w: 1800, h: 900 };
    case "study_table":  return { w: 1200, h: 600 };
    case "tv_unit":      return { w: 1500, h: 400 };
    case "wc":           return { w: 700, h: 500 };
    case "washbasin":    return { w: 600, h: 450 };
    case "shower":       return { w: 900, h: 900 };
    case "bathtub":      return { w: 1700, h: 700 };
    case "kitchen_sink": return { w: 800, h: 500 };
    case "stove_platform": return { w: 1200, h: 600 };
    case "fridge":       return { w: 700, h: 700 };
    case "washing_machine": return { w: 600, h: 600 };
    default:             return { w: 600, h: 600 };
  }
}

function fixtureLabel(type: string): string {
  return type.replace(/_/g, " ");
}

function DimensionsLayer({ plan }: { plan: PlanIR }) {
  // Show overall plot dimensions as labels
  const w = plan.meta.plot_width_mm;
  const h = plan.meta.plot_depth_mm;
  return (
    <>
      <Text
        text={mmToMeters(w)}
        x={w / 2 - 600}
        y={-450}
        fontSize={200}
        fill="#64748b"
        listening={false}
      />
      <Text
        text={mmToMeters(h)}
        x={-1100}
        y={h / 2 - 100}
        fontSize={200}
        fill="#64748b"
        rotation={-90}
        listening={false}
      />
    </>
  );
}

function ScaleIndicator({ scale }: { scale: number }) {
  // Show a 1m bar
  const px = 1000 * scale;
  return (
    <div className="absolute bottom-3 left-3 flex items-center gap-2 text-xs text-muted-foreground bg-card/80 backdrop-blur px-2 py-1 rounded border">
      <div style={{ width: px, height: 4 }} className="bg-foreground/70 rounded" />
      <span>1 m</span>
    </div>
  );
}
