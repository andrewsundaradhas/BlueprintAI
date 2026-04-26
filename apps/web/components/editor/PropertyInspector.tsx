"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjectStore } from "@/lib/store/project";
import { useToast } from "@/components/ui/toast";
import { type WallType, type OpeningType, WALL_THICKNESS_MM } from "@/lib/schema/plan";
import { wallVector } from "@/lib/canvas/geometry";

const WALL_TYPES: { value: WallType; label: string }[] = [
  { value: "exterior_brick_230", label: "Exterior brick — 230mm" },
  { value: "interior_brick_115", label: "Interior brick — 115mm" },
  { value: "rcc_150",            label: "RCC — 150mm" },
  { value: "drywall_100",        label: "Drywall — 100mm" },
];

const OPENING_TYPES: { value: OpeningType; label: string }[] = [
  { value: "door_single",     label: "Single door" },
  { value: "door_double",     label: "Double door" },
  { value: "door_sliding",    label: "Sliding door" },
  { value: "window_casement", label: "Casement window" },
  { value: "window_sliding",  label: "Sliding window" },
  { value: "window_fixed",    label: "Fixed window" },
  { value: "ventilator",      label: "Ventilator" },
];

const FLOOR_FINISHES = [
  { v: "vitrified_tile_600x600_sqm", l: "Vitrified Tile 600×600" },
  { v: "granite_floor_sqm",          l: "Granite" },
  { v: "marble_floor_sqm",           l: "Marble" },
  { v: "ceramic_tile_300x600_sqm",   l: "Ceramic Tile 300×600" },
];

const WALL_FINISHES = [
  { v: "putty_emulsion_sqm",       l: "Putty + Emulsion" },
  { v: "ceramic_tile_300x600_sqm", l: "Ceramic Tile" },
];

const CEILING_FINISHES = [
  { v: "pop_false_ceiling_sqm",    l: "POP False Ceiling" },
  { v: "gypsum_false_ceiling_sqm", l: "Gypsum False Ceiling" },
];

const OPENING_MATERIALS = [
  { v: "",         l: "Default" },
  { v: "teak",     l: "Teak (door)" },
  { v: "upvc",     l: "UPVC (window)" },
  { v: "aluminum", l: "Aluminum (window/door)" },
];

export function PropertyInspector() {
  const plan = useProjectStore((s) => s.plan);
  const selection = useProjectStore((s) => s.selection);
  const apply = useProjectStore((s) => s.applyCommand);
  const { toast } = useToast();

  if (!plan || !selection) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Select something on the canvas to edit its properties.
      </div>
    );
  }

  const floor = plan.floors[0];
  if (!floor) return null;

  if (selection.kind === "wall") {
    const w = floor.walls.find((x) => x.id === selection.id);
    if (!w) return null;
    const len = wallVector(w).len;
    return (
      <div className="p-4 space-y-4">
        <Header title="Wall" subtitle={w.id} />
        <Field label="Length">
          <Input value={(len / 1000).toFixed(3) + " m"} disabled />
        </Field>
        <Field label="Type">
          <Select value={w.type} onValueChange={(v) => apply({ kind: "wall.changeType", floor: 0, id: w.id, type: v as WallType }, toast)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {WALL_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Thickness">
          <Input value={WALL_THICKNESS_MM[w.type] + " mm"} disabled />
        </Field>
        <Field label="Height">
          <Input value={w.height_mm + " mm"} disabled />
        </Field>
        <Button
          variant="destructive"
          size="sm"
          className="w-full gap-1.5"
          onClick={() => apply({ kind: "wall.delete", floor: 0, id: w.id }, toast)}
        >
          <Trash2 className="size-3.5" /> Delete wall
        </Button>
      </div>
    );
  }

  if (selection.kind === "opening") {
    const o = floor.openings.find((x) => x.id === selection.id);
    if (!o) return null;
    return (
      <div className="p-4 space-y-4">
        <Header title="Opening" subtitle={o.id} />
        <Field label="Type">
          <Select value={o.type} onValueChange={(v) => apply({ kind: "opening.changeType", floor: 0, id: o.id, type: v as OpeningType }, toast)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {OPENING_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Material">
          <Select
            value={o.material ?? ""}
            onValueChange={(v) =>
              apply({ kind: "opening.changeMaterial", floor: 0, id: o.id, material: v || undefined }, toast)
            }
          >
            <SelectTrigger><SelectValue placeholder="Default" /></SelectTrigger>
            <SelectContent>
              {OPENING_MATERIALS.map((m) => (
                <SelectItem key={m.v || "default"} value={m.v}>{m.l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Width (mm)">
            <Input value={o.width_mm} disabled />
          </Field>
          <Field label="Height (mm)">
            <Input value={o.height_mm} disabled />
          </Field>
        </div>
        <Field label="Position along wall">
          <input
            type="range"
            min={0.05}
            max={0.95}
            step={0.01}
            value={o.position_along_wall}
            onChange={(e) =>
              apply({ kind: "opening.move", floor: 0, id: o.id, position_along_wall: parseFloat(e.target.value) }, toast)
            }
            className="w-full accent-primary"
          />
          <p className="text-xs text-muted-foreground tabular-nums">{(o.position_along_wall * 100).toFixed(0)}%</p>
        </Field>
        <Button
          variant="destructive"
          size="sm"
          className="w-full gap-1.5"
          onClick={() => apply({ kind: "opening.delete", floor: 0, id: o.id }, toast)}
        >
          <Trash2 className="size-3.5" /> Delete opening
        </Button>
      </div>
    );
  }

  if (selection.kind === "room") {
    const r = floor.rooms.find((x) => x.id === selection.id);
    if (!r) return null;
    return (
      <div className="p-4 space-y-4">
        <Header title="Room" subtitle={r.id} />
        <Field label="Name">
          <Input
            defaultValue={r.name}
            onBlur={(e) => apply({ kind: "room.changeName", floor: 0, id: r.id, name: e.target.value }, toast)}
          />
        </Field>
        <Field label="Floor finish">
          <Select
            value={r.finishes.floor}
            onValueChange={(v) =>
              apply({
                kind: "room.changeFinishes",
                floor: 0,
                id: r.id,
                finishes: { ...r.finishes, floor: v },
              }, toast)
            }
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FLOOR_FINISHES.map((f) => <SelectItem key={f.v} value={f.v}>{f.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Wall finish">
          <Select
            value={r.finishes.wall_finish}
            onValueChange={(v) =>
              apply({
                kind: "room.changeFinishes",
                floor: 0,
                id: r.id,
                finishes: { ...r.finishes, wall_finish: v },
              }, toast)
            }
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {WALL_FINISHES.map((f) => <SelectItem key={f.v} value={f.v}>{f.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Ceiling">
          <Select
            value={r.finishes.ceiling}
            onValueChange={(v) =>
              apply({
                kind: "room.changeFinishes",
                floor: 0,
                id: r.id,
                finishes: { ...r.finishes, ceiling: v },
              }, toast)
            }
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CEILING_FINISHES.map((f) => <SelectItem key={f.v} value={f.v}>{f.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <div>
          <Label className="text-xs text-muted-foreground">Fixtures ({r.fixtures.length})</Label>
          <div className="mt-1 space-y-1">
            {r.fixtures.map((f, i) => (
              <div key={i} className="flex items-center justify-between text-xs px-2 py-1.5 rounded border bg-muted/40">
                <span className="capitalize">{f.type.replace(/_/g, " ")}</span>
                <button
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  onClick={() => apply({ kind: "fixture.delete", floor: 0, roomId: r.id, idx: i }, toast)}
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="border-b pb-2">
      <p className="text-xs text-muted-foreground">Selected</p>
      <p className="font-semibold">{title}</p>
      <p className="text-[11px] text-muted-foreground font-mono">{subtitle}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
