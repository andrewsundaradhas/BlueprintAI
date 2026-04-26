"use client";

import * as React from "react";
import { Share, Download, ChevronDown } from "@/components/icons";
import { useEditor } from "@/lib/store/editor";
import { Button } from "@/components/ui/button";

export function Topbar({
  onExport,
}: {
  onExport: (kind: "json" | "csv" | "pdf" | "dxf") => void;
}) {
  const projectName = useEditor((s) => s.projectName);
  const setProjectName = useEditor((s) => s.setProjectName);
  const status = useEditor((s) => s.status);
  const [exportOpen, setExportOpen] = React.useState(false);

  const dotColor =
    status.kind === "err" ? "rgb(var(--danger))" : status.kind === "gen" ? "rgb(var(--warning))" : "rgb(var(--success))";

  return (
    <div
      className="grid items-center gap-4 px-4 surface-1 border-b border-border-subtle"
      style={{ gridTemplateColumns: "1fr auto 1fr" }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="display font-semibold text-md inline-flex items-baseline" style={{ letterSpacing: "-0.02em" }}>
          BluePrint<span className="text-accent font-bold ml-px" style={{ fontSize: "60%" }}>AI</span>
        </span>
        <span className="text-quaternary text-xs">/</span>
        <span className="text-xs text-tertiary">Studio Vora</span>
        <span className="text-quaternary text-xs">/</span>
        <input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="bg-transparent text-sm font-medium text-primary px-1.5 py-1 rounded-sm border border-transparent hover:border-border-default focus:border-accent focus:bg-surface-3 focus:outline-none min-w-[180px]"
        />
      </div>

      <div className="flex justify-center">
        <div className="inline-flex items-center gap-2 mono text-xs text-secondary px-2.5 py-1 border border-border-subtle rounded surface-2">
          <span className="size-1.5 rounded-pill" style={{ background: dotColor }} />
          {status.text}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="secondary" size="sm" className="gap-1.5">
          <Share size={14} /> Share
        </Button>
        <div className="relative">
          <Button
            variant="secondary"
            size="sm"
            className="gap-1.5"
            onClick={() => setExportOpen((o) => !o)}
          >
            <Download size={14} /> Export <ChevronDown size={14} className="text-tertiary" />
          </Button>
          {exportOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setExportOpen(false)} />
              <div className="absolute right-0 mt-1 w-44 surface-2 border border-border-default rounded shadow-lg z-40 p-1 animate-fade-in">
                {[
                  { id: "json", label: "Plan IR — JSON" },
                  { id: "csv",  label: "BOQ — CSV" },
                  { id: "pdf",  label: "PDF (drawing + BOQ)" },
                  { id: "dxf",  label: "DXF — CAD" },
                ].map((it) => (
                  <button
                    key={it.id}
                    onClick={() => {
                      setExportOpen(false);
                      onExport(it.id as "json" | "csv" | "pdf" | "dxf");
                    }}
                    className="w-full text-left text-sm text-primary px-2 py-1.5 rounded-sm hover:bg-surface-3"
                  >
                    {it.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="w-px h-5 bg-border-subtle mx-1" />
        <div className="size-[26px] rounded-pill grid place-items-center text-2xs font-semibold text-white" style={{ background: "linear-gradient(135deg, #2D7FF9, #4A91FA)" }}>
          RV
        </div>
      </div>
    </div>
  );
}
