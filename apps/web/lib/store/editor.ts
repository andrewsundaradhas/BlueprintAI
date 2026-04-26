"use client";

import { create } from "zustand";
import { type PlanIR } from "@/lib/schema/plan";
import { type BoqResult } from "@/lib/boq/engine";
import { type PlanSpec, SEED_SPEC, type SolvedPlan, solveLayout } from "@/lib/solver/solver";
import { solvedPlanToPlanIR } from "@/lib/solver/to-plan-ir";

export type Tool =
  | "select"
  | "wall"
  | "door"
  | "window"
  | "room"
  | "fixture"
  | "dimension";

export type ViewMode = "2D" | "3D" | "Split";
export type Status = { kind: "ok" | "gen" | "err"; text: string };

export type FloorState = {
  id: string;
  num: string;
  name: string;
  spec: PlanSpec;
  plan: SolvedPlan;
  planIR: PlanIR;
  boq: BoqResult | null;
};

export type EditorStore = {
  // Floors
  floors: FloorState[];
  activeFloorId: string;
  setActiveFloorId: (id: string) => void;
  addFloor: () => void;
  renameFloor: (id: string, name: string) => void;
  deleteFloor: (id: string) => void;
  /** Replace the entire floor set (used when hydrating from localStorage). */
  hydrateFloors: (floors: { id: string; num: string; name: string; spec: PlanSpec }[], activeFloorId: string) => void;

  // Spec mutations
  setActiveFloorPlan: (next: { spec: PlanSpec; plan: SolvedPlan; planIR: PlanIR; boq?: BoqResult | null }) => void;
  appendNewFloor: (next: { spec: PlanSpec; plan: SolvedPlan; planIR: PlanIR; boq?: BoqResult | null }) => void;
  updateRoomDirect: (roomId: string, changes: Partial<{ name: string; area: number; zone: PlanSpec["rooms"][number]["zone"] }>) => void;
  addRoom: (name?: string, area?: number, zone?: PlanSpec["rooms"][number]["zone"]) => void;
  deleteRoom: (roomId: string) => void;
  setBoqForFloor: (floorId: string, boq: BoqResult) => void;

  // Selection
  selectedRoomId: string | null;
  setSelectedRoomId: (id: string | null) => void;

  // Tools / view / canvas
  tool: Tool;
  setTool: (t: Tool) => void;
  view: ViewMode;
  setView: (v: ViewMode) => void;
  showGrid: boolean;
  toggleGrid: () => void;
  showDimensions: boolean;
  toggleDimensions: () => void;
  snapEnabled: boolean;
  toggleSnap: () => void;
  orthoEnabled: boolean;
  toggleOrtho: () => void;

  // Layers
  layers: { id: string; name: string; visible: boolean }[];
  toggleLayer: (id: string) => void;
  addLayer: (name: string) => void;
  removeLayer: (id: string) => void;

  // Zoom + pan
  zoom: number;
  pan: { x: number; y: number };
  setZoom: (z: number) => void;
  setPan: (p: { x: number; y: number }) => void;
  resetView: () => void;

  // History
  history: { floors: FloorState[]; activeFloorId: string }[];
  hIdx: number;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  // Loading / error / status
  loading: boolean;
  setLoading: (b: boolean) => void;
  loadPhase: number;
  setLoadPhase: (n: number) => void;
  status: Status;
  setStatus: (s: Status) => void;
  error: string | null;
  setError: (e: string | null) => void;

  // Project meta
  projectId: string | null;
  setProjectId: (id: string | null) => void;
  projectName: string;
  setProjectName: (n: string) => void;

  // Cmd palette
  cmdOpen: boolean;
  setCmdOpen: (b: boolean) => void;

  /**
   * True once the user has generated (or hydrated) at least one plan.
   * Editor page uses this to decide whether to show the first-prompt hero.
   */
  hasGenerated: boolean;
  setHasGenerated: (b: boolean) => void;
};

const DEFAULT_LAYERS = [
  { id: "walls", name: "Walls",      visible: true },
  { id: "open",  name: "Openings",   visible: true },
  { id: "rooms", name: "Rooms",      visible: true },
  { id: "fix",   name: "Fixtures",   visible: true },
  { id: "dim",   name: "Dimensions", visible: true },
  { id: "grid",  name: "Grid",       visible: true },
];

function makeInitialFloor(id: string, num: string, name: string, spec: PlanSpec): FloorState {
  const plan = solveLayout(spec);
  const planIR = solvedPlanToPlanIR({ spec, plan });
  return { id, num, name, spec, plan, planIR, boq: null };
}

const seedFloor = makeInitialFloor("gf", "00", "Ground floor", SEED_SPEC);

function rebuildFromSpec(spec: PlanSpec): { plan: SolvedPlan; planIR: PlanIR } {
  const plan = solveLayout(spec);
  const planIR = solvedPlanToPlanIR({ spec, plan });
  return { plan, planIR };
}

export const useEditor = create<EditorStore>((set, get) => ({
  floors: [seedFloor],
  activeFloorId: "gf",

  setActiveFloorId: (id) => set({ activeFloorId: id, selectedRoomId: null }),

  addFloor: () => {
    const { floors, activeFloorId } = get();
    const num = String(floors.length).padStart(2, "0");
    const id = `f${Date.now()}`;
    const seed = JSON.parse(JSON.stringify(floors.find((f) => f.id === activeFloorId)!.spec)) as PlanSpec;
    seed.prompt = `Floor ${num}`;
    const nf = makeInitialFloor(id, num, `Floor ${num}`, seed);
    set({ floors: [...floors, nf], activeFloorId: id, selectedRoomId: null });
    get().pushHistory();
  },

  renameFloor: (id, name) =>
    set((s) => ({ floors: s.floors.map((f) => (f.id === id ? { ...f, name } : f)) })),

  hydrateFloors: (saved, activeFloorId) => {
    const floors: FloorState[] = saved.map((f) => {
      const plan = solveLayout(f.spec);
      const planIR = solvedPlanToPlanIR({ spec: f.spec, plan });
      return { id: f.id, num: f.num, name: f.name, spec: f.spec, plan, planIR, boq: null };
    });
    if (!floors.length) return;
    const active = floors.some((f) => f.id === activeFloorId) ? activeFloorId : floors[0]!.id;
    set({
      floors,
      activeFloorId: active,
      selectedRoomId: null,
      hasGenerated: true,
      history: [{ floors: JSON.parse(JSON.stringify(floors)) as FloorState[], activeFloorId: active }],
      hIdx: 0,
    });
  },

  deleteFloor: (id) => {
    const { floors, activeFloorId } = get();
    if (floors.length <= 1) return;
    const next = floors.filter((f) => f.id !== id);
    set({
      floors: next,
      activeFloorId: activeFloorId === id ? next[0]!.id : activeFloorId,
      selectedRoomId: null,
    });
    get().pushHistory();
  },

  setActiveFloorPlan: (next) => {
    set((s) => ({
      floors: s.floors.map((f) =>
        f.id === s.activeFloorId
          ? { ...f, spec: next.spec, plan: next.plan, planIR: next.planIR, boq: next.boq ?? null }
          : f,
      ),
      selectedRoomId: null,
      hasGenerated: true,
      // First generation lands the user in Split view so 2D + 3D show together
      view: !s.hasGenerated && s.view === "2D" ? "Split" : s.view,
      // Auto-fit on every plan change
      zoom: 1,
      pan: { x: 0, y: 0 },
    }));
    get().pushHistory();
  },

  appendNewFloor: (next) => {
    const { floors, view, hasGenerated } = get();
    const num = String(floors.length).padStart(2, "0");
    const id = `f${Date.now()}`;
    const newFloor: FloorState = {
      id,
      num,
      name: `Floor ${num}`,
      spec: next.spec,
      plan: next.plan,
      planIR: next.planIR,
      boq: next.boq ?? null,
    };
    set({
      floors: [...floors, newFloor],
      activeFloorId: id,
      selectedRoomId: null,
      hasGenerated: true,
      view: !hasGenerated && view === "2D" ? "Split" : view,
      zoom: 1,
      pan: { x: 0, y: 0 },
    });
    get().pushHistory();
  },

  updateRoomDirect: (roomId, changes) => {
    set((s) => ({
      floors: s.floors.map((f) => {
        if (f.id !== s.activeFloorId) return f;
        const newSpec: PlanSpec = {
          ...f.spec,
          rooms: f.spec.rooms.map((r) => (r.id === roomId ? { ...r, ...changes } : r)),
        };
        const { plan, planIR } = rebuildFromSpec(newSpec);
        return { ...f, spec: newSpec, plan, planIR, boq: null };
      }),
    }));
    get().pushHistory();
  },

  addRoom: (name = "New Room", area = 9, zone = "private") => {
    const id = `r${Date.now()}`;
    set((s) => ({
      floors: s.floors.map((f) => {
        if (f.id !== s.activeFloorId) return f;
        const newSpec: PlanSpec = {
          ...f.spec,
          rooms: [...f.spec.rooms, { id, name, area, zone }],
        };
        const { plan, planIR } = rebuildFromSpec(newSpec);
        return { ...f, spec: newSpec, plan, planIR, boq: null };
      }),
      selectedRoomId: id,
      status: { kind: "ok", text: `Added "${name}"` },
    }));
    get().pushHistory();
  },

  deleteRoom: (roomId) => {
    set((s) => ({
      floors: s.floors.map((f) => {
        if (f.id !== s.activeFloorId) return f;
        const newSpec: PlanSpec = {
          ...f.spec,
          rooms: f.spec.rooms.filter((r) => r.id !== roomId),
        };
        const { plan, planIR } = rebuildFromSpec(newSpec);
        return { ...f, spec: newSpec, plan, planIR, boq: null };
      }),
      selectedRoomId: s.selectedRoomId === roomId ? null : s.selectedRoomId,
    }));
    get().pushHistory();
  },

  setBoqForFloor: (floorId, boq) =>
    set((s) => ({
      floors: s.floors.map((f) => (f.id === floorId ? { ...f, boq } : f)),
    })),

  selectedRoomId: null,
  setSelectedRoomId: (id) => set({ selectedRoomId: id }),

  tool: "select",
  setTool: (t) => set({ tool: t }),
  view: "2D",
  setView: (v) => set({ view: v }),
  showGrid: true,
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  showDimensions: true,
  toggleDimensions: () => set((s) => ({ showDimensions: !s.showDimensions })),
  snapEnabled: true,
  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
  orthoEnabled: false,
  toggleOrtho: () => set((s) => ({ orthoEnabled: !s.orthoEnabled })),

  layers: DEFAULT_LAYERS,
  toggleLayer: (id) =>
    set((s) => ({
      layers: s.layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)),
    })),
  addLayer: (name) =>
    set((s) => ({ layers: [...s.layers, { id: `l${Date.now()}`, name, visible: true }] })),
  removeLayer: (id) => set((s) => ({ layers: s.layers.filter((l) => l.id !== id) })),

  zoom: 1,
  pan: { x: 0, y: 0 },
  setZoom: (z) => set({ zoom: Math.max(0.25, Math.min(4, z)) }),
  setPan: (p) => set({ pan: p }),
  resetView: () => set({ zoom: 1, pan: { x: 0, y: 0 } }),

  history: [{ floors: [seedFloor], activeFloorId: "gf" }],
  hIdx: 0,
  pushHistory: () => {
    const { floors, activeFloorId, history, hIdx } = get();
    const snap = { floors: JSON.parse(JSON.stringify(floors)) as FloorState[], activeFloorId };
    const trimmed = history.slice(0, hIdx + 1);
    const next = [...trimmed, snap].slice(-50);
    set({ history: next, hIdx: next.length - 1 });
  },
  undo: () => {
    const { history, hIdx } = get();
    if (hIdx <= 0) return;
    const s = history[hIdx - 1]!;
    set({
      floors: JSON.parse(JSON.stringify(s.floors)) as FloorState[],
      activeFloorId: s.activeFloorId,
      hIdx: hIdx - 1,
      selectedRoomId: null,
    });
  },
  redo: () => {
    const { history, hIdx } = get();
    if (hIdx >= history.length - 1) return;
    const s = history[hIdx + 1]!;
    set({
      floors: JSON.parse(JSON.stringify(s.floors)) as FloorState[],
      activeFloorId: s.activeFloorId,
      hIdx: hIdx + 1,
      selectedRoomId: null,
    });
  },

  loading: false,
  setLoading: (b) => set({ loading: b }),
  loadPhase: 0,
  setLoadPhase: (n) => set({ loadPhase: n }),
  status: { kind: "ok", text: "All changes saved" },
  setStatus: (s) => set({ status: s }),
  error: null,
  setError: (e) => set({ error: e }),

  projectId: null,
  setProjectId: (id) => set({ projectId: id }),
  projectName: "Untitled project",
  setProjectName: (n) => set({ projectName: n }),

  cmdOpen: false,
  setCmdOpen: (b) => set({ cmdOpen: b }),

  hasGenerated: false,
  setHasGenerated: (b) => set({ hasGenerated: b }),
}));

export const selectActiveFloor = (s: EditorStore): FloorState =>
  s.floors.find((f) => f.id === s.activeFloorId) ?? s.floors[0]!;
