"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { Topbar } from "@/components/editor/Topbar";
import { LeftRail } from "@/components/editor/LeftRail";
import { RightPanel } from "@/components/editor/RightPanel";
import { Dock } from "@/components/editor/Dock";
import { LoadingWireframe } from "@/components/editor/LoadingWireframe";
import { HeroPrompt } from "@/components/editor/HeroPrompt";
import { OnboardingHint } from "@/components/editor/OnboardingHint";
import { useEditor, selectActiveFloor } from "@/lib/store/editor";
import { Plus, Minus } from "@/components/icons";
import { useToast } from "@/components/ui/toast";
import { saveProject, getProject, loadEditorState, saveEditorState } from "@/lib/firebase/projects";

const FloorPlanSVG = dynamic(
  () => import("@/components/editor/FloorPlanSVG").then((m) => m.FloorPlanSVG),
  { ssr: false, loading: () => <CanvasLoading label="Loading 2D canvas…" /> },
);
const View3D = dynamic(
  () => import("@/components/editor/View3D").then((m) => m.View3D),
  { ssr: false, loading: () => <CanvasLoading label="Loading 3D view…" /> },
);

export default function EditorPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { toast } = useToast();

  const setProjectId = useEditor((s) => s.setProjectId);
  const projectName = useEditor((s) => s.projectName);
  const setProjectName = useEditor((s) => s.setProjectName);
  const view = useEditor((s) => s.view);
  const setView = useEditor((s) => s.setView);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const setTool = useEditor((s) => s.setTool);
  const toggleGrid = useEditor((s) => s.toggleGrid);
  const toggleSnap = useEditor((s) => s.toggleSnap);
  const setSelectedRoomId = useEditor((s) => s.setSelectedRoomId);
  const selectedRoomId = useEditor((s) => s.selectedRoomId);
  const loading = useEditor((s) => s.loading);
  const loadPhase = useEditor((s) => s.loadPhase);
  const error = useEditor((s) => s.error);
  const setError = useEditor((s) => s.setError);
  const status = useEditor((s) => s.status);
  const showGrid = useEditor((s) => s.showGrid);
  const showDimensions = useEditor((s) => s.showDimensions);
  const zoom = useEditor((s) => s.zoom);
  const setZoom = useEditor((s) => s.setZoom);
  const pan = useEditor((s) => s.pan);
  const setPan = useEditor((s) => s.setPan);
  const resetView = useEditor((s) => s.resetView);
  const activeFloor = useEditor(selectActiveFloor);
  const setActiveFloorPlan = useEditor((s) => s.setActiveFloorPlan);
  const hydrateFloors = useEditor((s) => s.hydrateFloors);
  const floors = useEditor((s) => s.floors);
  const activeFloorId = useEditor((s) => s.activeFloorId);
  const tool = useEditor((s) => s.tool);
  const addRoom = useEditor((s) => s.addRoom);
  const hasGenerated = useEditor((s) => s.hasGenerated);

  const dragRef = React.useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const [hydrated, setHydrated] = React.useState(false);

  // Hydrate project from localStorage
  React.useEffect(() => {
    if (!id) return;
    setProjectId(id);
    const existing = getProject(id);
    if (existing) setProjectName(existing.name);

    // Restore full multi-floor editor state if present
    const saved = loadEditorState(id);
    if (saved && saved.floors.length > 0) {
      hydrateFloors(saved.floors, saved.activeFloorId);
      if (saved.projectName) setProjectName(saved.projectName);
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Autosave (debounced 1.5s) — both project meta + multi-floor state
  React.useEffect(() => {
    if (!hydrated || !id) return;
    const t = setTimeout(() => {
      try {
        saveProject({ id, name: projectName, plan: activeFloor.planIR });
        saveEditorState(id, {
          floors: floors.map((f) => ({ id: f.id, num: f.num, name: f.name, spec: f.spec })),
          activeFloorId,
          projectName,
          updated_at: new Date().toISOString(),
        });
      } catch {
        // ignore
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [hydrated, id, projectName, activeFloor.planIR, floors, activeFloorId]);

  // Keyboard shortcuts
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
      if (e.key === "Tab" && !inField) {
        e.preventDefault();
        const next = view === "2D" ? "Split" : view === "Split" ? "3D" : "2D";
        setView(next);
      }
      if (!e.metaKey && !e.ctrlKey && !inField) {
        const m: Record<string, "select" | "wall" | "door" | "window" | "room" | "fixture" | "dimension"> = {
          v: "select", w: "wall", d: "door", n: "window",
          r: "room", f: "fixture", m: "dimension",
        };
        const t = m[e.key.toLowerCase()];
        if (t) setTool(t);
        if (e.key.toLowerCase() === "g") toggleGrid();
        if (e.key.toLowerCase() === "s" && !e.metaKey && !e.ctrlKey) toggleSnap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, view, setView, setTool, toggleGrid, toggleSnap]);

  // Canvas pan/zoom handlers
  const onWheel = React.useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const delta = -e.deltaY * 0.002;
        setZoom(zoom * (1 + delta));
      } else {
        setPan({ x: pan.x - e.deltaX, y: pan.y - e.deltaY });
      }
    },
    [zoom, pan, setZoom, setPan],
  );

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      e.preventDefault();
      dragRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
      return;
    }
    // Room tool: clicking the canvas (not a room rect) adds a new room
    if (e.button === 0 && tool === "room" && view === "2D") {
      const tag = (e.target as HTMLElement | SVGElement).tagName;
      if (tag !== "rect" || !(e.target as Element).classList.contains("room-fill")) {
        const name = window.prompt("Name the new room", "New Room")?.trim();
        if (name) {
          addRoom(name, 9, "private");
          setTool("select");
        }
      }
    }
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    setPan({ x: dragRef.current.px + (e.clientX - dragRef.current.x), y: dragRef.current.py + (e.clientY - dragRef.current.y) });
  };
  const onMouseUp = () => {
    dragRef.current = null;
  };

  const onExport = async (kind: "json" | "csv" | "pdf" | "dxf") => {
    if (!activeFloor.planIR) return;
    try {
      if (kind === "json") {
        const blob = new Blob([JSON.stringify(activeFloor.planIR, null, 2)], { type: "application/json" });
        triggerDownload(blob, `${projectName || "plan"}.json`);
        toast("Exported JSON", { kind: "success" });
        return;
      }
      const r = await fetch(`/api/export/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: activeFloor.planIR }),
      });
      if (!r.ok) throw new Error(await r.text());
      const blob = await r.blob();
      triggerDownload(blob, `${projectName || "plan"}.${kind === "csv" ? "csv" : kind === "pdf" ? "pdf" : "dxf"}`);
      toast(`Exported ${kind.toUpperCase()}`, { kind: "success" });
    } catch (e) {
      toast("Export failed", { kind: "error", body: (e as Error).message });
    }
  };
  void status; // surfaced via Topbar
  void setActiveFloorPlan; // used inside Dock & RightPanel

  return (
    <div className="grid h-screen overflow-hidden" style={{ gridTemplateRows: "44px 1fr 56px" }}>
      <Topbar onExport={onExport} />
      <div className="grid min-h-0" style={{ gridTemplateColumns: "240px 1fr 320px" }}>
        <LeftRail />

        <div
          className="surface-canvas relative overflow-hidden"
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          {!loading && hasGenerated && view === "2D" && (
            <div
              className="absolute inset-0"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "center center",
                transition: dragRef.current ? "none" : "transform 0.1s",
              }}
            >
              <FloorPlanSVG
                plan={activeFloor.plan}
                selectedId={selectedRoomId}
                onSelect={(r) => setSelectedRoomId(r.id)}
                showGrid={showGrid}
                showDimensions={showDimensions}
              />
            </div>
          )}
          {!loading && hasGenerated && view === "3D" && <View3D />}
          {!loading && hasGenerated && view === "Split" && (
            <div className="absolute inset-0 grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div
                className="relative overflow-hidden border-r border-border-subtle"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: "center center",
                  transition: dragRef.current ? "none" : "transform 0.1s",
                }}
              >
                <FloorPlanSVG
                  plan={activeFloor.plan}
                  selectedId={selectedRoomId}
                  onSelect={(r) => setSelectedRoomId(r.id)}
                  showGrid={showGrid}
                  showDimensions={showDimensions}
                />
              </div>
              <div className="relative overflow-hidden">
                <View3D />
              </div>
            </div>
          )}
          {!loading && !hasGenerated && <HeroPrompt />}
          {!loading && hasGenerated && <OnboardingHint />}
          {loading && <LoadingWireframe phase={loadPhase} />}

          {!loading && hasGenerated && (
            <div className="absolute inset-0 pointer-events-none">
              {/* North arrow */}
              <svg viewBox="0 0 44 44" className="absolute top-4 right-4 size-11 pointer-events-none">
                <circle cx="22" cy="22" r="20" fill="none" stroke="rgb(var(--fg-tertiary))" strokeWidth="1" />
                <path d="M22 8 L17 28 L22 24 L27 28 Z" fill="rgb(var(--fg-primary))" />
                <text x="22" y="40" textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" fill="rgb(var(--fg-tertiary))">N</text>
              </svg>

              {/* Coord pill */}
              <div className="absolute bottom-3 left-3 mono text-2xs text-tertiary surface-1 border border-border-subtle px-2 py-1 rounded-sm">
                {activeFloor.name} · {activeFloor.plan.plot.w}×{activeFloor.plan.plot.h} mm · 1:{Math.round(50 / zoom)}
              </div>

              {/* Zoom bar */}
              <div className="absolute bottom-3 right-3 inline-flex items-center surface-1 border border-border-subtle rounded pointer-events-auto">
                <button onClick={() => setZoom(zoom / 1.2)} className="size-[26px] grid place-items-center text-secondary hover:text-primary"><Minus size={14} /></button>
                <span className="mono text-2xs text-secondary px-2 border-l border-r border-border-subtle h-[26px] inline-flex items-center">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(zoom * 1.2)} className="size-[26px] grid place-items-center text-secondary hover:text-primary"><Plus size={14} /></button>
                <button onClick={() => resetView()} className="px-2 mono text-2xs text-tertiary hover:text-primary border-l border-border-subtle h-[26px]">fit</button>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 surface-2 border border-danger border-l-2 rounded px-4 py-3 text-xs text-primary max-w-md">
              <div className="font-semibold mb-0.5">Generation failed</div>
              <div className="text-secondary">{error}</div>
              <button onClick={() => setError(null)} className="mt-1.5 mono text-2xs text-tertiary hover:text-primary">dismiss</button>
            </div>
          )}
        </div>

        <RightPanel />
      </div>
      <Dock />
    </div>
  );
}

function CanvasLoading({ label }: { label: string }) {
  return (
    <div className="w-full h-full grid place-items-center">
      <div className="mono text-xs text-tertiary">{label}</div>
    </div>
  );
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
