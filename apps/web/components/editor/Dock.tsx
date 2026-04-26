"use client";

import * as React from "react";
import {
  Select as SelectIcon,
  Wall,
  Door,
  Window as WindowIcon,
  Room as RoomIcon,
  Fixture,
  Dimension,
  Snap,
  Grid as GridIcon,
  Ortho,
  Undo,
  Redo,
  Search,
  Sparkle,
} from "@/components/icons";
import { useEditor, type Tool } from "@/lib/store/editor";
import { useCommand } from "@/components/ui/command-palette";
import { useToast } from "@/components/ui/toast";
import type { PlanIR } from "@/lib/schema/plan";
import type { PlanSpec, SolvedPlan } from "@/lib/solver/solver";
import type { BoqResult } from "@/lib/boq/engine";

const TOOLS: { id: Tool; icon: React.ReactNode; label: string; sc: string }[] = [
  { id: "select",    icon: <SelectIcon />, label: "Select",    sc: "V" },
  { id: "wall",      icon: <Wall />,       label: "Wall",      sc: "W" },
  { id: "door",      icon: <Door />,       label: "Door",      sc: "D" },
  { id: "window",    icon: <WindowIcon />, label: "Window",    sc: "N" },
  { id: "room",      icon: <RoomIcon />,   label: "Room",      sc: "R" },
  { id: "fixture",   icon: <Fixture />,    label: "Fixture",   sc: "F" },
  { id: "dimension", icon: <Dimension />,  label: "Dimension", sc: "M" },
];

export function Dock() {
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const view = useEditor((s) => s.view);
  const setView = useEditor((s) => s.setView);
  const snapEnabled = useEditor((s) => s.snapEnabled);
  const toggleSnap = useEditor((s) => s.toggleSnap);
  const showGrid = useEditor((s) => s.showGrid);
  const toggleGrid = useEditor((s) => s.toggleGrid);
  const orthoEnabled = useEditor((s) => s.orthoEnabled);
  const toggleOrtho = useEditor((s) => s.toggleOrtho);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const hIdx = useEditor((s) => s.hIdx);
  const historyLen = useEditor((s) => s.history.length);
  const canUndo = hIdx > 0;
  const canRedo = hIdx < historyLen - 1;
  const cmd = useCommand();

  const setLoading = useEditor((s) => s.setLoading);
  const setLoadPhase = useEditor((s) => s.setLoadPhase);
  const setStatus = useEditor((s) => s.setStatus);
  const setError = useEditor((s) => s.setError);
  const setActiveFloorPlan = useEditor((s) => s.setActiveFloorPlan);
  const appendNewFloor = useEditor((s) => s.appendNewFloor);
  const loading = useEditor((s) => s.loading);
  const activeSpec = useEditor((s) => s.floors.find((f) => f.id === s.activeFloorId)?.spec);
  const { toast } = useToast();

  const [text, setText] = React.useState("");
  const examples = [
    "3BHK on 12×10m plot, east-facing, ₹35L budget",
    "1BHK studio, 6×8m, balcony",
    "2BHK with prayer room, 9×11m plot",
  ];

  const generate = async (newFloor = false) => {
    const t = text.trim() || examples[0]!;
    if (loading) return;
    setLoading(true);
    setError(null);
    setStatus({ kind: "gen", text: "Generating plan…" });
    setLoadPhase(0);
    const phaseT = [
      setTimeout(() => setLoadPhase(1), 1200),
      setTimeout(() => setLoadPhase(2), 2400),
      setTimeout(() => setLoadPhase(3), 3300),
      setTimeout(() => setLoadPhase(4), 4000),
    ];
    try {
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: t }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = (await r.json()) as {
        spec: PlanSpec;
        plan: SolvedPlan;
        planIR: PlanIR;
        boq: BoqResult | null;
        source?: string;
        warnings?: string[];
      };
      const target = { spec: data.spec, plan: data.plan, planIR: data.planIR, boq: data.boq };
      if (newFloor) appendNewFloor(target);
      else setActiveFloorPlan(target);
      setStatus({ kind: "ok", text: `Plan generated · ${data.source ?? "ok"}` });
      if (data.warnings?.length) toast(data.warnings[0]!, { kind: "info" });
      setText("");
    } catch (e) {
      setError((e as Error).message);
      setStatus({ kind: "err", text: "Generation failed" });
      toast("Generation failed", { kind: "error", body: (e as Error).message });
    } finally {
      phaseT.forEach(clearTimeout);
      setLoading(false);
    }
  };

  // Wire command palette handler whenever generate ref changes
  React.useEffect(() => {
    cmd.setHandler({
      onGenerate: (p) => {
        setText(p);
        setTimeout(() => void generate(false), 0);
      },
      onGenerateFloor: (p) => {
        setText(p);
        setTimeout(() => void generate(true), 0);
      },
      onSelectTool: (id) => setTool(id as Tool),
    });
    return () => cmd.setHandler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="surface-1 border-t border-border-subtle grid"
      style={{ gridTemplateRows: "32px 1fr" }}
    >
      {/* Toolbar */}
      <div className="flex items-center px-3 gap-1 border-b border-border-subtle h-8">
        <ToolGroup>
          {TOOLS.map((t) => (
            <ToolBtn
              key={t.id}
              active={tool === t.id}
              title={`${t.label}  ${t.sc}`}
              onClick={() => setTool(t.id)}
            >
              {t.icon}
            </ToolBtn>
          ))}
        </ToolGroup>
        <Sep />
        <ToolGroup>
          <ToolBtn active={snapEnabled} title="Snap" onClick={toggleSnap}><Snap /></ToolBtn>
          <ToolBtn active={showGrid}    title="Grid (G)" onClick={toggleGrid}><GridIcon /></ToolBtn>
          <ToolBtn active={orthoEnabled} title="Ortho" onClick={toggleOrtho}><Ortho /></ToolBtn>
        </ToolGroup>
        <Sep />
        <ToolGroup>
          <ToolBtn title="Undo (⌘Z)" disabled={!canUndo} onClick={undo}><Undo /></ToolBtn>
          <ToolBtn title="Redo (⌘Y)" disabled={!canRedo} onClick={redo}><Redo /></ToolBtn>
        </ToolGroup>
        <div className="flex-1" />
        <button
          onClick={() => cmd.open()}
          className="inline-flex items-center gap-1.5 h-7 px-2 mono text-xs text-tertiary hover:text-primary hover:bg-surface-2 rounded"
        >
          <Search size={14} /> Search & commands
          <Kbd className="ml-1">⌘ K</Kbd>
        </button>
        <Sep />
        <Segmented
          value={view}
          onChange={(v) => setView(v as "2D" | "3D")}
          options={[
            { value: "2D", label: "2D" },
            { value: "3D", label: "3D" },
          ]}
        />
      </div>

      {/* Prompt panel */}
      <div className="p-3 flex gap-2 items-start border-t border-border-subtle">
        <span className="inline-flex text-accent mt-1.5"><Sparkle size={16} /></span>
        <div className="flex-1 flex flex-col gap-1.5">
          <div className="flex gap-2 items-start">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void generate(false);
              }}
              placeholder={activeSpec?.prompt ?? "Describe the home: BHK count, plot dimensions, facing, budget…"}
              className="flex-1 h-14 resize-none bg-surface-3 border border-border-default rounded px-3 py-2 text-sm text-primary outline-none focus:border-accent"
            />
            <div className="flex flex-col gap-1">
              <button
                onClick={() => void generate(false)}
                disabled={loading}
                className="inline-flex items-center justify-center h-7 px-3 text-xs font-medium bg-accent hover:bg-accent-hover active:bg-accent-pressed rounded text-white disabled:opacity-60 disabled:cursor-wait"
              >{loading ? "Generating…" : "Replace floor"}</button>
              <button
                onClick={() => void generate(true)}
                disabled={loading}
                className="inline-flex items-center justify-center h-7 px-3 text-xs font-medium surface-3 border border-border-default rounded text-primary hover:border-border-strong disabled:opacity-60"
              >+ New floor</button>
            </div>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {examples.map((ex, i) => (
              <button
                key={i}
                onClick={() => setText(ex)}
                className="px-2 py-px text-2xs surface-2 border border-border-subtle text-secondary rounded-sm mono cursor-pointer hover:text-primary"
              >{ex}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

function Sep() {
  return <div className="w-px h-5 bg-border-subtle mx-2" />;
}

function ToolBtn({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      data-active={active ? "true" : undefined}
      className="relative inline-flex items-center justify-center size-8 rounded text-secondary hover:bg-surface-2 hover:text-primary disabled:opacity-40 disabled:pointer-events-none data-[active=true]:bg-[var(--accent-soft)] data-[active=true]:text-accent data-[active=true]:after:content-[''] data-[active=true]:after:absolute data-[active=true]:after:left-1 data-[active=true]:after:right-1 data-[active=true]:after:-bottom-px data-[active=true]:after:h-[2px] data-[active=true]:after:bg-accent data-[active=true]:after:rounded-pill"
    >
      {children}
    </button>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="inline-flex surface-3 border border-border-default rounded p-0.5 gap-0.5 h-[26px]">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`px-3 text-xs h-[22px] rounded-sm inline-flex items-center ${active ? "bg-surface-1 text-primary shadow-sm" : "text-secondary hover:text-primary"}`}
          >{o.label}</button>
        );
      })}
    </div>
  );
}

function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center mono text-2xs px-[5px] py-px border border-border-default rounded-sm text-secondary surface-2 min-w-[16px] h-4 ${className ?? ""}`}>
      {children}
    </span>
  );
}
