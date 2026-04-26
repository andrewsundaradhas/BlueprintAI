"use client";

import * as React from "react";
import { Sparkle } from "@/components/icons";
import { cn } from "@/lib/utils";

type Provider = { id: "gemini" | "claude" | "openai" | "demo"; available: boolean; label: string };
type Health = { providers: Provider[]; activeProvider: Provider["id"]; activeLabel: string };

/**
 * Small pill in the topbar: shows which AI is generating.
 *  - Gemini / Claude / OpenAI → green dot, "Powered by …"
 *  - demo (no keys)            → amber dot, "Heuristic mode" + ⓘ tooltip
 */
export function AiStatus() {
  const [h, setH] = React.useState<Health | null>(null);
  const [showSetup, setShowSetup] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then((r) => r.json())
      .then((d: Health) => { if (!cancelled) setH(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!h) return null;
  const isDemo = h.activeProvider === "demo";

  return (
    <div className="relative">
      <button
        onClick={() => setShowSetup((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 mono text-xs px-2.5 py-1 border rounded surface-2",
          isDemo ? "border-warning/40 text-warning" : "border-success/40 text-success",
        )}
        title={isDemo ? "No LLM keys — using heuristic parser" : `Powered by ${h.activeLabel}`}
      >
        <Sparkle size={12} />
        <span className="text-secondary">{isDemo ? "Heuristic" : h.activeLabel.split(" ")[0]}</span>
      </button>

      {showSetup && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowSetup(false)} />
          <div className="absolute right-0 mt-2 w-80 surface-2 border border-border-default rounded-md shadow-lg z-40 p-4 animate-fade-in-up">
            <div className="text-sm font-medium text-primary mb-2">AI providers</div>
            <ul className="space-y-1.5 mb-3">
              {h.providers.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-xs">
                  <span className="text-secondary">{p.label}</span>
                  <span
                    className={cn(
                      "mono px-1.5 py-px rounded-sm border text-2xs",
                      p.id === h.activeProvider
                        ? "border-success/40 text-success bg-success/5"
                        : p.available
                        ? "border-border-default text-tertiary"
                        : "border-border-subtle text-quaternary",
                    )}
                  >
                    {p.id === h.activeProvider ? "active" : p.available ? "ready" : "not configured"}
                  </span>
                </li>
              ))}
            </ul>
            {isDemo && (
              <div className="text-xs text-secondary leading-relaxed border-t border-border-subtle pt-3">
                <p className="mb-2">
                  Add any one of these keys to <span className="mono text-primary">apps/web/.env.local</span>:
                </p>
                <pre className="mono text-2xs surface-3 px-2 py-2 rounded border border-border-default text-tertiary overflow-x-auto">
{`GEMINI_API_KEY=…
ANTHROPIC_API_KEY=…
OPENAI_API_KEY=…`}
                </pre>
                <p className="mt-2 text-tertiary">
                  Get a free Gemini key at{" "}
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent underline-offset-4 hover:underline"
                  >
                    aistudio.google.com/apikey
                  </a>
                  . Restart the dev server after adding.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
