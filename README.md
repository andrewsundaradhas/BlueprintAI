# BluePrintAI

Floor plans + 3D + BOQ. From a sentence.

A Next.js 14 monorepo for **prompt-to-2D floor plans + Bill of Quantities in INR**, built for Indian architects and civil engineers.

## What it does

1. **Prompt → 2D plan** — type "2BHK in Anand, 8×11m, north entry, ₹24L" and get an editable floor plan.
2. **3D walk-through** — toggle to a Three.js extruded view.
3. **Live BOQ** — every edit re-derives a deterministic Bill of Quantities in ₹.
4. **Per-room AI edit** — select any room, type "make this a study", let the LLM redesign just that room.
5. **Multi-floor** — add G+1, G+2 in the left rail.
6. **Exports** — JSON (Plan IR), CSV (BOQ), PDF (drawing + BOQ), DXF (CAD).

## Quick start

```bash
pnpm install
pnpm --filter @blueprintai/web dev
# open http://localhost:3000
```

The app runs in **demo mode** without any API keys — a procedural plan generator
produces valid 2BHK / 3BHK plans against any plot. Add `GEMINI_API_KEY` and/or
`ANTHROPIC_API_KEY` to `apps/web/.env.local` to enable real LLM generation.

## Architecture

```
apps/web/
├─ app/
│  ├─ page.tsx                  # Marketing landing
│  ├─ pricing/page.tsx
│  ├─ dashboard/page.tsx        # Project list (localStorage)
│  ├─ project/[id]/page.tsx     # Editor (the hero)
│  ├─ project/new/page.tsx      # Redirect to a fresh project
│  └─ api/
│     ├─ generate/route.ts      # POST: prompt → spec → plan → planIR + BOQ
│     ├─ refine/route.ts        # POST: full-floor refine OR per-room edit
│     └─ export/{csv,pdf,dxf}/route.ts
├─ components/
│  ├─ editor/                   # Topbar, LeftRail, RightPanel, Dock,
│  │                            # FloorPlanSVG, View3D, LoadingWireframe
│  ├─ ui/                       # button, input, card, tabs, tooltip,
│  │                            # toast, command-palette, …
│  └─ icons.tsx                 # custom Lucide-style icons
└─ lib/
   ├─ schema/                   # Plan IR (Zod), invariants, migrations
   ├─ boq/                      # Deterministic BOQ engine + INR rates
   ├─ solver/                   # Layout solver + spec→PlanIR adapter
   ├─ llm/                      # generate-spec (Gemini/Claude/demo)
   ├─ store/                    # Zustand editor store
   └─ firebase/                 # localStorage project store (Firebase optional)
```


MIT.
