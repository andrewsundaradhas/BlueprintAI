"use client";

import * as React from "react";
import { Sparkles, Wand2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useProjectStore } from "@/lib/store/project";
import { useToast } from "@/components/ui/toast";
import { type PlanIR } from "@/lib/schema/plan";

const STARTER_PROMPTS = [
  "1200 sqft 3BHK on a 30x40 ft plot, north facing, in Chennai. Vastu-compliant.",
  "Compact 2BHK for a 25x35 plot, east facing, with utility balcony.",
  "1500 sqft 3BHK with master bedroom, attached bath, open kitchen, and a puja room.",
];

const REFINE_SUGGESTIONS = [
  "Make the master bedroom larger.",
  "Add a balcony to the living room.",
  "Swap the kitchen and dining areas.",
  "Use teak doors for all bedrooms.",
  "Convert one bedroom into a study.",
];

export function PromptPanel() {
  const plan = useProjectStore((s) => s.plan);
  const setPlan = useProjectStore((s) => s.setPlanFromGenerate);
  const projectName = useProjectStore((s) => s.projectName);
  const { toast } = useToast();
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [step, setStep] = React.useState<string | null>(null);

  const isRefine = !!plan;

  const stepCycle = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (!busy) {
      if (stepCycle.current) clearInterval(stepCycle.current);
      setStep(null);
      return;
    }
    const steps = ["Laying out rooms…", "Placing walls…", "Cutting openings…", "Validating geometry…"];
    let i = 0;
    setStep(steps[0]!);
    stepCycle.current = window.setInterval(() => {
      i = (i + 1) % steps.length;
      setStep(steps[i]!);
    }, 1400);
    return () => {
      if (stepCycle.current) clearInterval(stepCycle.current);
    };
  }, [busy]);

  async function run() {
    if (!text.trim()) {
      toast("Please describe the building first.", "warning");
      return;
    }
    setBusy(true);
    try {
      const meta = plan?.meta ?? defaultMeta(projectName);
      const url = isRefine ? "/api/refine" : "/api/generate";
      const body = isRefine
        ? { plan, instruction: text }
        : { prompt: text, meta };
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || "Request failed");
      }
      const data = (await r.json()) as { plan: PlanIR; source: string; warnings?: string[] };
      setPlan(data.plan);
      if (data.warnings?.length) {
        toast(data.warnings[0]!, "info");
      }
      toast(`${isRefine ? "Refined" : "Generated"} via ${data.source}`, "success");
      setText("");
    } catch (e) {
      toast("Generation failed: " + (e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const suggestions = isRefine ? REFINE_SUGGESTIONS : STARTER_PROMPTS;

  return (
    <div className="glass rounded-xl shadow-md p-3 space-y-2 w-full max-w-3xl">
      <div className="flex items-center gap-2 text-sm font-medium">
        {isRefine ? (
          <>
            <Wand2 className="size-4 text-primary" />
            <span>Refine the plan</span>
          </>
        ) : (
          <>
            <Sparkles className="size-4 text-primary" />
            <span>Describe your dream home</span>
          </>
        )}
      </div>
      <div className="flex gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder={
            isRefine
              ? "e.g. Make the kitchen open-plan and add a study…"
              : "e.g. 1200 sqft 3BHK on a 30x40 plot, north facing, in Chennai…"
          }
          className="bg-background/70"
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void run();
            }
          }}
        />
        <Button onClick={run} disabled={busy} size="lg" className="shrink-0 self-stretch px-6">
          {busy ? <Loader2 className="size-4 animate-spin" /> : isRefine ? "Refine" : "Generate"}
        </Button>
      </div>
      {busy && step && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <span className="inline-block size-1.5 rounded-full bg-primary animate-pulse" />
          {step}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => setText(s)}
            disabled={busy}
            className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function defaultMeta(projectName: string): PlanIR["meta"] {
  return {
    name: projectName || "Untitled Project",
    plot_width_mm: 9000,   // 30 ft
    plot_depth_mm: 12000,  // 40 ft
    facing: "N",
    city: "Chennai",
    region_pricing_key: "south_metro_tier1",
  };
}
