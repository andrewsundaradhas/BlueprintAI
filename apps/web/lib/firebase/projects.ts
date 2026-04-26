"use client";

import { type PlanIR } from "@/lib/schema/plan";
import type { PlanSpec } from "@/lib/solver/solver";

/**
 * Project store. Uses localStorage as the default backend so the app
 * works out of the box without Firebase configured.
 *
 * Two storage keys:
 *  - "blueprintai.projects.v1"   — list of project meta + active-floor PlanIR
 *  - "blueprintai.editor.v1.<id>" — full multi-floor editor state per project
 */
export type StoredProject = {
  id: string;
  name: string;
  plan: PlanIR;             // active floor's PlanIR — used by dashboard thumb + BOQ
  created_at: string;
  updated_at: string;
};

export type StoredFloor = {
  id: string;
  num: string;
  name: string;
  spec: PlanSpec;           // re-solved on load
};

export type StoredEditorState = {
  floors: StoredFloor[];
  activeFloorId: string;
  projectName: string;
  updated_at: string;
};

const PROJECTS_KEY = "blueprintai.projects.v1";
const editorKey = (id: string) => `blueprintai.editor.v1.${id}`;

function read(): StoredProject[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredProject[];
  } catch {
    return [];
  }
}

function write(items: StoredProject[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(items));
}

export function listProjects(): StoredProject[] {
  return read().sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function getProject(id: string): StoredProject | undefined {
  return read().find((p) => p.id === id);
}

export function saveProject(args: {
  id?: string;
  name: string;
  plan: PlanIR;
}): StoredProject {
  const items = read();
  const now = new Date().toISOString();
  const id = args.id ?? `prj_${Math.random().toString(36).slice(2, 11)}`;
  const existingIdx = items.findIndex((p) => p.id === id);
  const project: StoredProject = {
    id,
    name: args.name,
    plan: args.plan,
    created_at: existingIdx >= 0 ? items[existingIdx]!.created_at : now,
    updated_at: now,
  };
  if (existingIdx >= 0) items[existingIdx] = project;
  else items.unshift(project);
  write(items);
  return project;
}

export function deleteProject(id: string): void {
  write(read().filter((p) => p.id !== id));
  if (typeof window !== "undefined") {
    localStorage.removeItem(editorKey(id));
  }
}

export function newProjectId(): string {
  return `prj_${Math.random().toString(36).slice(2, 11)}`;
}

// ────────── Multi-floor editor state ──────────

export function loadEditorState(id: string): StoredEditorState | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(editorKey(id));
    if (!raw) return undefined;
    return JSON.parse(raw) as StoredEditorState;
  } catch {
    return undefined;
  }
}

export function saveEditorState(id: string, state: StoredEditorState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(editorKey(id), JSON.stringify(state));
  } catch {
    // Quota or serialization error — ignore so the UI stays responsive.
  }
}
