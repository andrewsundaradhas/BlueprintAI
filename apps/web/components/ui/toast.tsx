"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastKind = "info" | "warning" | "error" | "success";
export type ToastItem = { id: string; msg: string; kind: ToastKind };

type Ctx = {
  toast: (msg: string, kind?: ToastKind) => void;
};

const ToastCtx = React.createContext<Ctx | null>(null);

export function useToast(): Ctx {
  const v = React.useContext(ToastCtx);
  if (!v) return { toast: () => {} };
  return v;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const toast = React.useCallback((msg: string, kind: ToastKind = "info") => {
    const id = Math.random().toString(36).slice(2, 9);
    setItems((s) => [...s, { id, msg, kind }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "min-w-[260px] max-w-sm rounded-lg border bg-card text-card-foreground shadow-lg p-3 flex items-start gap-2 animate-slide-up pointer-events-auto",
              t.kind === "error" && "border-destructive/50",
              t.kind === "warning" && "border-amber-500/50",
              t.kind === "success" && "border-emerald-500/50",
            )}
          >
            {t.kind === "success" && <CheckCircle2 className="size-4 text-emerald-500 mt-0.5" />}
            {t.kind === "warning" && <AlertCircle className="size-4 text-amber-500 mt-0.5" />}
            {t.kind === "error" && <XCircle className="size-4 text-destructive mt-0.5" />}
            {t.kind === "info" && <Info className="size-4 text-primary mt-0.5" />}
            <span className="text-sm leading-snug">{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
