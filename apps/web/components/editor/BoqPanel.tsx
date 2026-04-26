"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useProjectStore } from "@/lib/store/project";
import { computeBoq, type BoqResult } from "@/lib/boq/engine";
import { formatINR, formatINRShort } from "@/lib/utils";
import { Wallet, IndianRupee, Layers, Building, Search } from "lucide-react";

const CATEGORY_LABEL: Record<string, string> = {
  civil: "Civil",
  masonry: "Masonry",
  steel: "Steel",
  doors_windows: "Doors & Windows",
  finishes: "Finishes",
  electrical: "Electrical",
  plumbing: "Plumbing",
  labor: "Labor",
};

export function BoqPanel() {
  const plan = useProjectStore((s) => s.plan);
  const setSelection = useProjectStore((s) => s.setSelection);
  const [boq, setBoq] = React.useState<BoqResult | null>(null);
  const [search, setSearch] = React.useState("");

  // Recompute (debounced) on plan change
  React.useEffect(() => {
    if (!plan) {
      setBoq(null);
      return;
    }
    const handle = setTimeout(() => {
      void computeBoq(plan).then(setBoq).catch(() => setBoq(null));
    }, 300);
    return () => clearTimeout(handle);
  }, [plan]);

  if (!plan) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Generate a plan to see the BOQ.
      </div>
    );
  }

  if (!boq) {
    return (
      <div className="p-6 space-y-3">
        <div className="shimmer h-24 rounded-lg" />
        <div className="shimmer h-32 rounded-lg" />
        <div className="shimmer h-48 rounded-lg" />
      </div>
    );
  }

  const filteredLines = boq.lines.filter(
    (l) =>
      !search ||
      l.display_name.toLowerCase().includes(search.toLowerCase()) ||
      l.itemKey.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 space-y-3 border-b">
        <div className="rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Wallet className="size-3.5" /> Estimated total
          </div>
          <div className="text-3xl font-semibold tracking-tight">
            {formatINR(boq.grand_total_inr)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {formatINRShort(boq.grand_total_inr)} · {boq.lines.length} line items
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
            <Tile label="Subtotal" value={boq.subtotal_inr} />
            <Tile label={`Cont. ${boq.contingency_pct}%`} value={boq.contingency_inr} />
            <Tile label={`GST ${boq.gst_pct}%`} value={boq.gst_inr} />
          </div>
        </div>
      </div>

      <Tabs defaultValue="category" className="flex-1 flex flex-col min-h-0">
        <div className="px-4 pt-3">
          <TabsList className="w-full">
            <TabsTrigger value="category" className="flex-1 text-xs gap-1"><Layers className="size-3.5" />Category</TabsTrigger>
            <TabsTrigger value="room"     className="flex-1 text-xs gap-1"><Building className="size-3.5" />Room</TabsTrigger>
            <TabsTrigger value="lines"    className="flex-1 text-xs gap-1"><IndianRupee className="size-3.5" />All</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="category" className="flex-1 mt-0 min-h-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-2">
              {Object.entries(boq.byCategory)
                .sort(([, a], [, b]) => b - a)
                .map(([cat, amt]) => (
                  <CategoryRow
                    key={cat}
                    label={CATEGORY_LABEL[cat] ?? cat}
                    amount={amt}
                    pct={amt / boq.subtotal_inr}
                  />
                ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="room" className="flex-1 mt-0 min-h-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-2">
              {Object.entries(boq.byRoom).length === 0 && (
                <p className="text-xs text-muted-foreground">No room-attributed costs yet.</p>
              )}
              {Object.entries(boq.byRoom)
                .sort(([, a], [, b]) => b - a)
                .map(([roomId, amt]) => {
                  const r = plan.floors[0]?.rooms.find((x) => x.id === roomId);
                  return (
                    <button
                      key={roomId}
                      onClick={() => setSelection({ kind: "room", id: roomId })}
                      className="w-full text-left p-3 rounded-lg border hover:bg-accent/50 transition-colors flex items-center justify-between"
                    >
                      <span className="text-sm font-medium">{r?.name ?? roomId}</span>
                      <span className="text-sm tabular-nums">{formatINR(amt)}</span>
                    </button>
                  );
                })}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="lines" className="flex-1 mt-0 min-h-0 overflow-hidden flex flex-col">
          <div className="px-4 pb-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search items…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 pt-0 space-y-1">
              {filteredLines.map((line, i) => (
                <button
                  key={`${line.itemKey}-${i}`}
                  onClick={() => {
                    if (line.source.kind === "room" || line.source.kind === "fixture") {
                      setSelection({ kind: "room", id: line.source.roomId });
                    } else if (line.source.kind === "wall") {
                      setSelection({ kind: "wall", id: line.source.id });
                    } else if (line.source.kind === "opening") {
                      setSelection({ kind: "opening", id: line.source.id });
                    }
                  }}
                  className="w-full text-left p-2 rounded-md hover:bg-accent/50 transition-colors group"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-medium truncate group-hover:text-primary">{line.display_name}</span>
                    <span className="text-xs tabular-nums shrink-0">{formatINR(line.amount_inr)}</span>
                  </div>
                  <div className="flex items-baseline justify-between text-[11px] text-muted-foreground">
                    <span>{line.quantity.toLocaleString("en-IN", { maximumFractionDigits: 2 })} {line.unit}</span>
                    <span>@ {formatINR(line.rate_inr)}</span>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-background/50 px-2 py-1.5">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-xs font-medium tabular-nums">{formatINRShort(value)}</div>
    </div>
  );
}

function CategoryRow({ label, amount, pct }: { label: string; amount: number; pct: number }) {
  return (
    <div className="rounded-lg p-3 border bg-card hover:bg-accent/30 transition-colors">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm tabular-nums">{formatINR(amount)}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${Math.min(100, pct * 100)}%` }}
        />
      </div>
    </div>
  );
}
