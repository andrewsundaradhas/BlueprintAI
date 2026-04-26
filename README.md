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

### The two data shapes

- **`PlanSpec`** — what the LLM returns: `{ plot, rooms[{id,name,area,zone,entry?}], budget? }`
- **`SolvedPlan`** — what the solver produces: same rooms with `x,y,w,h,actualArea` + auto-detected openings
- **`PlanIR`** — canonical schema (walls, openings, polygons, finishes, fixtures) — drives the BOQ engine

The pipeline: `prompt → PlanSpec (LLM) → SolvedPlan (solver) → PlanIR (adapter) → BoqResult (engine)`

### Design system

Tokens live in [`apps/web/app/globals.css`](apps/web/app/globals.css) and
[`apps/web/tailwind.config.ts`](apps/web/tailwind.config.ts). They follow the
"precise / technical / calm" specification: one accent (`#2D7FF9`), 4px default
radius, 13/14px UI sizing, hairline borders, no purple.

Fonts: **Inter** (body), **JetBrains Mono** (numerics + shortcuts), **Fraunces**
(display headlines + room labels) — loaded via `next/font/google`.

## Testing

```bash
pnpm --filter @blueprintai/web test       # vitest unit suite (36 tests)
pnpm --filter @blueprintai/web typecheck
pnpm --filter @blueprintai/web test:e2e   # Playwright (config only)
```

## BOQ rates

Seed rates for `south_metro_tier1` are in [`lib/boq/seed-rates.ts`](apps/web/lib/boq/seed-rates.ts).
**These are illustrative starting points** — verify against current market quotations
before relying on them in production. Each `BoqResult` snapshots the rates it used
so historical estimates stay reproducible.

## Persistence

Without Firebase configured, projects are saved to `localStorage` per-browser.
Add the Firebase env vars in `.env.example` to enable cross-device sync (the
Firestore-backed implementation lives in `lib/firebase/projects.ts` as a TODO).

## Deployment

- **Web:** Vercel (`pnpm build && next start`)
- **Backend services:** Firebase (Auth + Firestore + Storage)
- **Payments:** Razorpay subscriptions

See `firestore.rules` for the security model.

## License

MIT.
