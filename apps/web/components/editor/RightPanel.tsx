"use client";

import * as React from "react";
import { Sparkle, Room as RoomIcon, ChevronDown } from "@/components/icons";
import { useEditor, selectActiveFloor } from "@/lib/store/editor";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { PlanSpec, SolvedRoom } from "@/lib/solver/solver";

type Tab = "Inspector" | "BOQ" | "Materials";

export function RightPanel() {
  const [tab, setTab] = React.useState<Tab>("Inspector");
  const activeFloor = useEditor(selectActiveFloor);
  const selectedRoomId = useEditor((s) => s.selectedRoomId);
  const selected = activeFloor.plan.rooms.find((r) => r.id === selectedRoomId) ?? null;

  return (
    <div className="surface-1 border-l border-border-subtle overflow-y-auto scrollbar-thin">
      <div className="flex items-center gap-4 px-4 border-b border-border-subtle">
        {(["Inspector", "BOQ", "Materials"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            data-active={tab === t ? "true" : undefined}
            className="relative py-3 text-secondary text-sm font-medium hover:text-primary data-[active=true]:text-primary data-[active=true]:after:content-[''] data-[active=true]:after:absolute data-[active=true]:after:left-0 data-[active=true]:after:right-0 data-[active=true]:after:-bottom-px data-[active=true]:after:h-[2px] data-[active=true]:after:bg-accent"
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Inspector" && <Inspector selected={selected} spec={activeFloor.spec} />}
      {tab === "BOQ" && <BoqPane />}
      {tab === "Materials" && <MaterialsPane />}
    </div>
  );
}

// ---------- Inspector ----------

function Inspector({ selected, spec }: { selected: SolvedRoom | null; spec: PlanSpec }) {
  const updateRoomDirect = useEditor((s) => s.updateRoomDirect);
  const setLoading = useEditor((s) => s.setLoading);
  const setStatus = useEditor((s) => s.setStatus);
  const setActiveFloorPlan = useEditor((s) => s.setActiveFloorPlan);
  const loading = useEditor((s) => s.loading);
  const activeFloor = useEditor(selectActiveFloor);
  const { toast } = useToast();
  const [aiPrompt, setAiPrompt] = React.useState("");

  if (!selected) {
    const totalArea =
      activeFloor.plan.rooms.reduce((s, r) => s + (r.actualArea || 0), 0) || 0;
    return (
      <div className="p-4">
        <Group title="Project">
          <div className="surface-2 border border-border-default rounded p-3 text-xs text-secondary mb-4">
            {spec?.prompt || "—"}
          </div>
          <Field label="Plot W">
            <ReadOnlyField value={activeFloor.plan.plot.w.toLocaleString()} unit="mm" />
          </Field>
          <Field label="Plot D">
            <ReadOnlyField value={activeFloor.plan.plot.h.toLocaleString()} unit="mm" />
          </Field>
          <Field label="Built-up">
            <ReadOnlyField value={totalArea.toFixed(2)} unit="sqm" />
          </Field>
        </Group>
        <div className="text-xs text-tertiary p-3 border border-dashed border-border-default rounded">
          Click a room on the canvas or in the outline to inspect & edit it.
        </div>
      </div>
    );
  }

  const onAiApply = async () => {
    if (!aiPrompt.trim() || loading) return;
    setLoading(true);
    setStatus({ kind: "gen", text: `Editing ${selected.name}…` });
    try {
      const r = await fetch("/api/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomEdit: {
            spec,
            roomId: selected.id,
            instruction: aiPrompt,
          },
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = (await r.json()) as { spec: PlanSpec; plan: SolvedRoom; planIR: import("@/lib/schema/plan").PlanIR; boq: import("@/lib/boq/engine").BoqResult | null };
      setActiveFloorPlan({
        spec: data.spec,
        plan: data.plan as unknown as import("@/lib/solver/solver").SolvedPlan,
        planIR: data.planIR,
        boq: data.boq,
      });
      setStatus({ kind: "ok", text: "Room updated" });
      setAiPrompt("");
    } catch (e) {
      setStatus({ kind: "err", text: "Edit failed" });
      toast("Room edit failed", { kind: "error", body: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      {/* Selection card */}
      <div className="border border-border-default rounded p-3 flex items-center gap-3 surface-2 mb-4">
        <div className="size-7 rounded-sm grid place-items-center text-accent" style={{ background: "var(--accent-soft)" }}>
          <RoomIcon size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-primary truncate">{selected.name}</div>
          <div className="mono text-2xs text-tertiary mt-0.5">
            Room · {Math.round(selected.w)} × {Math.round(selected.h)} mm
          </div>
        </div>
        <div className="size-1.5 rounded-pill bg-accent" />
      </div>

      {/* AI prompt */}
      <Group
        title={
          <span className="inline-flex items-center gap-1.5">
            <Sparkle size={12} className="text-accent" /> Modify with AI
          </span>
        }
      >
        <textarea
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          placeholder='e.g. "make this a study with desk", "convert to walk-in closet", "double the size"'
          className="w-full min-h-[56px] resize-y bg-surface-3 border border-border-default rounded px-3 py-2 text-xs text-primary outline-none focus:border-accent mb-2"
        />
        <Button
          variant="primary"
          size="sm"
          disabled={loading || !aiPrompt.trim()}
          onClick={onAiApply}
          className="w-full justify-center"
        >
          {loading ? "Working…" : "Apply"}
        </Button>
      </Group>

      <Group title="Geometry">
        <Field label="Name">
          <EditableField
            value={selected.name}
            onCommit={(v) => updateRoomDirect(selected.id, { name: v })}
          />
        </Field>
        <Field label="Area">
          <EditableField
            type="number"
            step="0.5"
            value={(selected.actualArea ?? 0).toFixed(1)}
            unit="sqm"
            mono
            onCommit={(v) => updateRoomDirect(selected.id, { area: parseFloat(v) || selected.area })}
          />
        </Field>
        <Field label="Zone">
          <select
            defaultValue={selected.zone || "private"}
            onChange={(e) =>
              updateRoomDirect(selected.id, {
                zone: e.target.value as "public" | "private" | "service",
              })
            }
            className="h-8 bg-surface-3 border border-border-default text-primary rounded px-2 text-sm outline-none focus:border-accent"
          >
            <option value="public">Public</option>
            <option value="private">Private</option>
            <option value="service">Service</option>
          </select>
        </Field>
        <Field label="Width">
          <ReadOnlyField value={Math.round(selected.w).toLocaleString()} unit="mm" />
        </Field>
        <Field label="Depth">
          <ReadOnlyField value={Math.round(selected.h).toLocaleString()} unit="mm" />
        </Field>
      </Group>

      <Group title="Material">
        <Field label="Walls">
          <SelectTrigger>Plaster · Asian Tractor</SelectTrigger>
        </Field>
        <Field label="Floor">
          <SelectTrigger>Vitrified · Kajaria 600</SelectTrigger>
        </Field>
        <Field label="Accent">
          <div className="flex gap-1">
            {["#E4E4E7", "#1F2937", "#7C5C3F", "#A1845A"].map((c, i) => (
              <button
                key={c}
                data-selected={i === 1 ? "true" : undefined}
                style={{ background: c }}
                className="size-[22px] rounded-sm border border-border-default data-[selected=true]:border-accent data-[selected=true]:[box-shadow:0_0_0_2px_var(--accent-soft)]"
              />
            ))}
          </div>
        </Field>
      </Group>
    </div>
  );
}

// ---------- BOQ ----------

function BoqPane() {
  const activeFloor = useEditor(selectActiveFloor);
  const setBoq = useEditor((s) => s.setBoqForFloor);
  const [tab, setTab] = React.useState<"category" | "room" | "lines">("category");

  // Recompute BOQ when missing
  React.useEffect(() => {
    if (activeFloor.boq != null) return;
    let cancelled = false;
    void import("@/lib/boq/engine").then(({ computeBoq }) =>
      computeBoq(activeFloor.planIR)
        .then((b) => {
          if (!cancelled) setBoq(activeFloor.id, b);
        })
        .catch(() => {}),
    );
    return () => {
      cancelled = true;
    };
  }, [activeFloor.id, activeFloor.boq, activeFloor.planIR, setBoq]);

  const builtUp =
    activeFloor.plan.rooms.reduce((s, r) => s + (r.actualArea || 0), 0) || 0;
  const sqft = builtUp * 10.764;
  const total = activeFloor.boq?.grand_total_inr ?? 0;
  const subtotal = activeFloor.boq?.subtotal_inr ?? 0;
  const cont = activeFloor.boq?.contingency_inr ?? 0;
  const gst = activeFloor.boq?.gst_inr ?? 0;
  const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");

  const split: [string, number][] = activeFloor.boq
    ? Object.entries(activeFloor.boq.byCategory)
        .filter(([, amt]) => amt > 0)
        .sort(([, a], [, b]) => b - a)
        .map(([k, v]) => [
          ({
            civil: "Civil & Structural",
            masonry: "Brickwork & Plaster",
            steel: "Steel",
            doors_windows: "Doors & Windows",
            finishes: "Flooring & Finishes",
            electrical: "Electrical",
            plumbing: "Plumbing & Sanitary",
            labor: "Labor",
          } as Record<string, string>)[k] ?? k,
          v as number,
        ])
    : [];
  const maxCat = Math.max(1, ...split.map(([, v]) => v));

  return (
    <div className="p-4">
      <div className="surface-2 border border-border-default rounded-lg p-5 mb-4">
        <div className="micro-label mb-2">Floor total</div>
        <div className="display font-semibold text-2xl tracking-tight tabular-nums flex items-baseline mb-3">
          <span className="text-secondary mr-1" style={{ fontSize: "60%" }}>₹</span>
          {fmt(total)}
        </div>
        <BoqLine label="Subtotal"             value={`₹ ${fmt(subtotal)}`} />
        <BoqLine label="Contingency · 5%"     value={`₹ ${fmt(cont)}`} />
        <BoqLine label="GST · 18%"            value={`₹ ${fmt(gst)}`} />
        <div className="h-px bg-border-subtle my-3" />
        <BoqLine
          dim
          label="Per sqft built-up"
          value={`₹ ${sqft > 0 ? fmt(total / sqft) : "—"}`}
        />
      </div>

      <div className="flex gap-4 text-xs border-b border-border-subtle mb-3">
        {([
          ["category", "By category"],
          ["room",     "By room"],
          ["lines",    "All lines"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            data-active={tab === id ? "true" : undefined}
            className="relative py-2 text-secondary data-[active=true]:text-primary data-[active=true]:after:content-[''] data-[active=true]:after:absolute data-[active=true]:after:left-0 data-[active=true]:after:right-0 data-[active=true]:after:-bottom-px data-[active=true]:after:h-[2px] data-[active=true]:after:bg-accent"
          >{label}</button>
        ))}
      </div>

      {tab === "category" && (
        <div>
          {!activeFloor.boq && (
            <div className="text-xs text-tertiary py-3">Computing…</div>
          )}
          {split.map(([name, amt]) => (
            <div
              key={name}
              className="grid items-center h-8 px-2 text-xs rounded-sm hover:bg-surface-2"
              style={{ gridTemplateColumns: "1fr 60px 70px" }}
            >
              <span className="text-primary truncate">{name}</span>
              <span className="bg-[var(--accent-edge)] h-[2px] rounded-pill justify-self-end" style={{ width: `${(amt / maxCat) * 60}px` }} />
              <span className="mono tabular-nums text-right text-secondary">₹ {fmt(amt)}</span>
            </div>
          ))}
        </div>
      )}

      {tab === "room" && (
        <div>
          {Object.entries(activeFloor.boq?.byRoom ?? {}).length === 0 && (
            <div className="text-xs text-tertiary py-3">No room-attributed costs yet.</div>
          )}
          {Object.entries(activeFloor.boq?.byRoom ?? {})
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .map(([roomId, amt]) => {
              const r = activeFloor.plan.rooms.find((x) => x.id === roomId);
              return (
                <div
                  key={roomId}
                  className="grid items-center h-8 px-2 text-xs rounded-sm hover:bg-surface-2"
                  style={{ gridTemplateColumns: "1fr 70px" }}
                >
                  <span className="text-primary truncate">{r?.name ?? roomId}</span>
                  <span className="mono tabular-nums text-right text-secondary">₹ {fmt(amt as number)}</span>
                </div>
              );
            })}
        </div>
      )}

      {tab === "lines" && (
        <div className="space-y-1">
          {(activeFloor.boq?.lines ?? []).slice(0, 80).map((l, i) => (
            <div key={`${l.itemKey}-${i}`} className="px-2 py-1.5 rounded-sm hover:bg-surface-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-primary truncate">{l.display_name}</span>
                <span className="mono text-2xs text-secondary tabular-nums shrink-0">₹ {fmt(l.amount_inr)}</span>
              </div>
              <div className="flex items-baseline justify-between text-2xs text-tertiary">
                <span>{l.quantity.toLocaleString("en-IN", { maximumFractionDigits: 2 })} {l.unit}</span>
                <span>@ ₹ {fmt(l.rate_inr)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BoqLine({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <div className={`flex justify-between text-xs py-0.5 ${dim ? "text-tertiary" : "text-secondary"}`}>
      <span>{label}</span>
      <span className="mono tabular-nums text-primary">{value}</span>
    </div>
  );
}

// ---------- Materials ----------

const TONE_PRESETS: Record<string, [string, string]> = {
  Floor: ["#D8D2C2", "#BFB8A4"],
  Walls: ["#D9D4C5", "#C7C0AC"],
  Counter: ["#1A1A1F", "#2A2A30"],
  Doors: ["#7C5C3F", "#5C4630"],
  Windows: ["#E4E4E7", "#C9C9CD"],
  Civil: ["#9CA3AF", "#6B7280"],
  Steel: ["#71717A", "#52525B"],
  Finishes: ["#A78BFA", "#7C3AED"],
  Electrical: ["#FBBF24", "#D97706"],
  Plumbing: ["#22D3EE", "#0891B2"],
  Custom: ["#3B82F6", "#1E40AF"],
};
const SEED_MATS = [
  { id: "m1", name: "Vitrified · 600×600",     price: "₹ 56 / sqft",  chip: "Floor"   },
  { id: "m2", name: "Granite · Black Galaxy",  price: "₹ 285 / sqft", chip: "Counter" },
  { id: "m3", name: "Brick · Wirecut Red",     price: "₹ 9.5 / pc",   chip: "Walls"   },
  { id: "m4", name: "Plaster · Birla Sand",    price: "₹ 14 / sqft",  chip: "Walls"   },
  { id: "m5", name: "Teak · Burma 4mm",        price: "₹ 320 / sqft", chip: "Doors"   },
  { id: "m6", name: "uPVC · Fenesta white",    price: "₹ 480 / sqft", chip: "Windows" },
];
const CATS = ["All", "Civil", "Steel", "Doors & Win", "Finishes", "Electrical", "Plumbing"];

function MaterialsPane() {
  const [mats, setMats] = React.useState(SEED_MATS);
  const [filter, setFilter] = React.useState("All");
  const [adding, setAdding] = React.useState(false);
  const [draft, setDraft] = React.useState({ name: "", price: "", chip: "Custom" });

  const matches = (m: { chip: string }) => {
    if (filter === "All") return true;
    if (filter === "Doors & Win") return m.chip === "Doors" || m.chip === "Windows";
    return m.chip === filter || m.chip.toLowerCase() === filter.toLowerCase();
  };

  const submit = () => {
    if (!draft.name.trim()) {
      setAdding(false);
      return;
    }
    const tone = TONE_PRESETS[draft.chip] ?? TONE_PRESETS.Custom!;
    setMats((ms) => [
      ...ms,
      { id: `m${Date.now()}`, name: draft.name.trim(), price: draft.price.trim() || "—", chip: draft.chip, tone } as never,
    ]);
    setDraft({ name: "", price: "", chip: "Custom" });
    setAdding(false);
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex flex-wrap gap-1">
          {CATS.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              data-active={filter === c ? "true" : undefined}
              className="px-2 py-px text-xs border border-border-subtle rounded surface-2 text-secondary data-[active=true]:bg-[var(--accent-soft)] data-[active=true]:text-accent data-[active=true]:border-[var(--accent-edge)]"
            >{c}</button>
          ))}
        </div>
        <Button variant="primary" size="xs" onClick={() => setAdding((a) => !a)}>+ Add</Button>
      </div>

      {adding && (
        <div className="surface-2 border border-[var(--accent-edge)] rounded p-3 mb-3 flex flex-col gap-1.5">
          <input
            autoFocus
            placeholder='Name (e.g. "Marble · Italian")'
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            className="bg-surface-3 border border-border-default text-primary rounded-sm px-2 py-1 text-xs outline-none focus:border-accent"
          />
          <input
            placeholder="Price (e.g. ₹ 250 / sqft)"
            value={draft.price}
            onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
            className="bg-surface-3 border border-border-default text-primary rounded-sm px-2 py-1 text-xs outline-none focus:border-accent"
          />
          <select
            value={draft.chip}
            onChange={(e) => setDraft((d) => ({ ...d, chip: e.target.value }))}
            className="bg-surface-3 border border-border-default text-primary rounded-sm px-2 py-1 text-xs outline-none focus:border-accent h-7"
          >
            {Object.keys(TONE_PRESETS).map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <div className="flex gap-1.5">
            <Button variant="primary" size="xs" onClick={submit} className="flex-1">Add</Button>
            <Button variant="secondary" size="xs" onClick={() => { setAdding(false); setDraft({ name: "", price: "", chip: "Custom" }); }} className="flex-1">Cancel</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {mats.filter(matches).map((m) => {
          const tone = (("tone" in m && (m as { tone: [string, string] }).tone) || TONE_PRESETS[m.chip] || TONE_PRESETS.Custom!) as [string, string];
          return (
            <div key={m.id} className="surface-2 border border-border-subtle rounded overflow-hidden cursor-grab relative">
              <div className="h-20 border-b border-border-subtle relative" style={{ background: `linear-gradient(135deg, ${tone[0]}, ${tone[1]})` }}>
                <span className="absolute top-1.5 left-1.5 mono text-[9px] text-white/80 bg-black/30 px-1 py-px rounded-sm">{m.chip}</span>
                <button
                  onClick={() => setMats((ms) => ms.filter((x) => x.id !== m.id))}
                  className="absolute top-1 right-1 text-white bg-black/40 rounded-sm size-[18px] grid place-items-center text-xs"
                >×</button>
              </div>
              <div className="px-3 py-1.5">
                <div className="text-xs font-medium text-primary truncate">{m.name}</div>
                <div className="mono text-2xs text-tertiary">{m.price}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Helpers ----------

function Group({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="micro-label mb-3">{title}</div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid items-center gap-3 mb-2" style={{ gridTemplateColumns: "88px 1fr" }}>
      <span className="text-xs text-secondary">{label}</span>
      {children}
    </div>
  );
}

function ReadOnlyField({ value, unit }: { value: string; unit?: string }) {
  return (
    <div className="flex items-center h-8 surface-3 border border-border-default rounded px-3 text-sm text-tertiary">
      <span className="flex-1 truncate">{value}</span>
      {unit && <span className="mono text-2xs text-tertiary ml-2">{unit}</span>}
    </div>
  );
}

function EditableField({
  value,
  unit,
  mono,
  type = "text",
  step,
  onCommit,
}: {
  value: string;
  unit?: string;
  mono?: boolean;
  type?: string;
  step?: string;
  onCommit: (v: string) => void;
}) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => setV(value), [value]);
  return (
    <div className="flex items-center h-8 surface-3 border border-border-default rounded px-3 focus-within:border-accent">
      <input
        type={type}
        step={step}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => v !== value && onCommit(v)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className={`flex-1 bg-transparent border-none outline-none text-sm text-primary ${mono ? "mono tabular-nums" : ""}`}
      />
      {unit && <span className="mono text-2xs text-tertiary ml-2">{unit}</span>}
    </div>
  );
}

function SelectTrigger({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between h-8 surface-3 border border-border-default rounded pl-3 pr-2 text-sm text-primary hover:border-border-strong">
      <span className="truncate">{children}</span>
      <ChevronDown size={14} className="text-tertiary" />
    </div>
  );
}
