"use client";

import * as React from "react";
import {
  MousePointer2,
  PenLine,
  DoorOpen,
  AppWindow,
  Square,
  Sofa,
  Hand,
  Undo2,
  Redo2,
  Grid3x3,
  Ruler,
  Magnet,
  Box,
  LayoutGrid,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useProjectStore, type Tool } from "@/lib/store/project";
import { cn } from "@/lib/utils";

export function Toolbar({ onExport }: { onExport: (kind: "csv" | "json") => void }) {
  const tool = useProjectStore((s) => s.tool);
  const setTool = useProjectStore((s) => s.setTool);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const canUndo = useProjectStore((s) => s.undoStack.length > 0);
  const canRedo = useProjectStore((s) => s.redoStack.length > 0);
  const showGrid = useProjectStore((s) => s.showGrid);
  const toggleGrid = useProjectStore((s) => s.toggleGrid);
  const showDimensions = useProjectStore((s) => s.showDimensions);
  const toggleDimensions = useProjectStore((s) => s.toggleDimensions);
  const snapEnabled = useProjectStore((s) => s.snapEnabled);
  const toggleSnap = useProjectStore((s) => s.toggleSnap);
  const view = useProjectStore((s) => s.view);
  const setView = useProjectStore((s) => s.setView);

  const tools: { id: Tool; label: string; icon: React.ReactNode; shortcut: string }[] = [
    { id: "select",  label: "Select",  icon: <MousePointer2 />, shortcut: "V" },
    { id: "wall",    label: "Wall",    icon: <PenLine />,       shortcut: "W" },
    { id: "door",    label: "Door",    icon: <DoorOpen />,      shortcut: "D" },
    { id: "window",  label: "Window",  icon: <AppWindow />,     shortcut: "N" },
    { id: "room",    label: "Room",    icon: <Square />,        shortcut: "R" },
    { id: "fixture", label: "Fixture", icon: <Sofa />,          shortcut: "F" },
    { id: "pan",     label: "Pan",     icon: <Hand />,          shortcut: "Space" },
  ];

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex items-center gap-1 px-3 py-2 glass rounded-xl shadow-md">
        {tools.map((t) => (
          <Tooltip key={t.id}>
            <TooltipTrigger asChild>
              <Button
                variant={tool === t.id ? "default" : "ghost"}
                size="icon"
                onClick={() => setTool(t.id)}
                aria-label={t.label}
              >
                {t.icon}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <span className="font-medium">{t.label}</span>
              <span className="ml-2 text-muted-foreground">{t.shortcut}</span>
            </TooltipContent>
          </Tooltip>
        ))}

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" disabled={!canUndo} onClick={undo}><Undo2 /></Button>
          </TooltipTrigger>
          <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" disabled={!canRedo} onClick={redo}><Redo2 /></Button>
          </TooltipTrigger>
          <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant={showGrid ? "secondary" : "ghost"} size="icon" onClick={toggleGrid}><Grid3x3 /></Button>
          </TooltipTrigger>
          <TooltipContent>Grid (G)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant={showDimensions ? "secondary" : "ghost"} size="icon" onClick={toggleDimensions}><Ruler /></Button>
          </TooltipTrigger>
          <TooltipContent>Dimensions</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant={snapEnabled ? "secondary" : "ghost"} size="icon" onClick={toggleSnap}><Magnet /></Button>
          </TooltipTrigger>
          <TooltipContent>Snap (S)</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <div className="flex items-center bg-muted rounded-md p-1">
          <button
            onClick={() => setView("2d")}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1.5",
              view === "2d" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <LayoutGrid className="size-3.5" /> 2D
          </button>
          <button
            onClick={() => setView("3d")}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1.5",
              view === "3d" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Box className="size-3.5" /> 3D
          </button>
        </div>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={() => onExport("csv")} className="gap-1.5">
              <Download className="size-4" /> CSV
            </Button>
          </TooltipTrigger>
          <TooltipContent>Export BOQ as CSV</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={() => onExport("json")} className="gap-1.5">
              <Download className="size-4" /> JSON
            </Button>
          </TooltipTrigger>
          <TooltipContent>Export Plan IR as JSON</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
