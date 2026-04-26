"use client";

import * as React from "react";
import { Sparkle } from "@/components/icons";

const STORAGE_KEY = "blueprintai.onboard.v1";

export function OnboardingHint() {
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    // Delay slightly so it animates in after the plan renders
    const t = setTimeout(() => setShow(true), 600);
    return () => clearTimeout(t);
  }, []);

  React.useEffect(() => {
    if (!show) return;
    const dismiss = () => {
      setShow(false);
      try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
    };
    const t = setTimeout(dismiss, 9000);
    const onClick = () => dismiss();
    window.addEventListener("click", onClick, { once: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener("click", onClick);
    };
  }, [show]);

  if (!show) return null;
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none animate-fade-in-up">
      <div className="surface-2 border border-[var(--accent-edge)] rounded-pill px-3 py-1.5 inline-flex items-center gap-2 text-xs shadow-md">
        <Sparkle size={12} className="text-accent" />
        <span className="text-secondary">Click any room to edit</span>
        <span className="text-quaternary">·</span>
        <span className="text-secondary">Press <kbd className="mono text-2xs px-1 py-px border border-border-default rounded-sm">Tab</kbd> to switch view</span>
        <span className="text-quaternary">·</span>
        <span className="text-secondary"><kbd className="mono text-2xs px-1 py-px border border-border-default rounded-sm">⌘K</kbd> for commands</span>
      </div>
    </div>
  );
}
