import Link from "next/link";
import { ArrowRight, Box, FileSpreadsheet, MessageSquareText, MousePointer2, Ruler, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <Hero />
      <HowItWorks />
      <Features />
      <CTA />
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/40 backdrop-blur bg-background/70">
      <div className="container flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <LogoMark />
          <span>BluePrintAI</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
          <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
          <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard">Dashboard</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/project/new" className="gap-1.5">
              Start free <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative gradient-mesh">
      <div className="absolute inset-0 bg-grid-pattern bg-[size:48px_48px] opacity-30 mask-fade-bottom" />
      <div className="container relative pt-20 pb-28 text-center max-w-4xl">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-primary/20 bg-primary/10 text-primary mb-6 animate-fade-in">
          <Sparkles className="size-3" />
          For Indian architects, civil engineers, and builders
        </div>
        <h1 className="text-5xl md:text-7xl font-semibold tracking-tight text-balance">
          Floor plan + 3D + BOQ.
          <br />
          <span className="bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
            From a sentence.
          </span>
        </h1>
        <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
          Describe your dream home in plain English. BluePrintAI generates an editable
          2D floor plan, an immersive 3D walk-through, and a fully detailed Bill of
          Quantities in INR — in seconds.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button size="lg" asChild className="gap-2 text-base h-12 px-7">
            <Link href="/project/new">
              Try the demo <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild className="text-base h-12 px-7">
            <Link href="/dashboard">Open dashboard</Link>
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">No sign-up required. Demo mode runs entirely in your browser.</p>

        <DemoCard />
      </div>
    </section>
  );
}

function DemoCard() {
  return (
    <div className="mt-16 max-w-3xl mx-auto">
      <Card className="overflow-hidden glass shadow-2xl shadow-primary/10 animate-slide-up">
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="p-6 text-left space-y-3 border-r border-border/50">
            <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <MessageSquareText className="size-3" /> You write
            </div>
            <p className="text-sm font-medium leading-relaxed">
              &ldquo;1200 sqft 3BHK on a 30×40 plot in Chennai, north-facing. Master bedroom
              with attached bath, open kitchen, and a small puja room.&rdquo;
            </p>
            <div className="text-xs uppercase tracking-wider text-muted-foreground pt-2 flex items-center gap-1.5">
              <Sparkles className="size-3 text-primary" /> BluePrintAI delivers
            </div>
            <ul className="text-sm space-y-1.5 text-muted-foreground">
              <li className="flex items-center gap-2"><MousePointer2 className="size-3.5 text-primary" /> Editable 2D floor plan</li>
              <li className="flex items-center gap-2"><Box className="size-3.5 text-primary" /> Walk-through 3D model</li>
              <li className="flex items-center gap-2"><FileSpreadsheet className="size-3.5 text-primary" /> Itemised BOQ in ₹</li>
              <li className="flex items-center gap-2"><Ruler className="size-3.5 text-primary" /> Live recompute on every edit</li>
            </ul>
          </div>
          <div className="p-6 bg-muted/30 flex items-center justify-center min-h-[280px]">
            <FakePlanIllustration />
          </div>
        </div>
      </Card>
    </div>
  );
}

function FakePlanIllustration() {
  return (
    <svg viewBox="0 0 240 200" className="w-full max-w-xs">
      <defs>
        <pattern id="g" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M 10 0 L 0 0 0 10" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="240" height="200" fill="url(#g)" opacity="0.6" />
      {/* Outer wall */}
      <rect x="20" y="20" width="200" height="160" stroke="hsl(var(--foreground))" strokeWidth="3" fill="none" />
      {/* Inner divisions */}
      <line x1="20" y1="100" x2="220" y2="100" stroke="hsl(var(--foreground))" strokeWidth="2" />
      <line x1="120" y1="20"  x2="120" y2="100" stroke="hsl(var(--foreground))" strokeWidth="2" />
      <line x1="140" y1="100" x2="140" y2="180" stroke="hsl(var(--foreground))" strokeWidth="2" />
      {/* Rooms */}
      <rect x="20"  y="20"  width="100" height="80" fill="rgb(99 102 241 / 0.18)" />
      <rect x="120" y="20"  width="100" height="80" fill="rgb(168 85 247 / 0.18)" />
      <rect x="20"  y="100" width="120" height="80" fill="rgb(34 197 94 / 0.18)" />
      <rect x="140" y="100" width="80"  height="80" fill="rgb(249 115 22 / 0.18)" />
      {/* Door arc */}
      <path d="M 70 180 A 12 12 0 0 1 70 168" stroke="hsl(var(--primary))" strokeWidth="1.5" fill="none" />
      <line x1="58" y1="180" x2="82" y2="180" stroke="hsl(var(--background))" strokeWidth="3" />
      {/* Windows */}
      <line x1="50" y1="20" x2="90" y2="20" stroke="hsl(var(--background))" strokeWidth="3" />
      <line x1="50" y1="20" x2="90" y2="20" stroke="hsl(217 91% 60%)" strokeWidth="1.5" />
    </svg>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "1",
      title: "Describe it",
      body: "Type a brief in plain English. Plot size, BHK count, facing, city — anything. We handle the rest.",
      icon: <MessageSquareText className="size-5" />,
    },
    {
      n: "2",
      title: "Edit live",
      body: "Drag walls, swap doors, change finishes — in 2D. Every change re-derives the BOQ instantly.",
      icon: <MousePointer2 className="size-5" />,
    },
    {
      n: "3",
      title: "Walk through",
      body: "Toggle to 3D for an immersive view. See your project before a single brick is laid.",
      icon: <Box className="size-5" />,
    },
    {
      n: "4",
      title: "Cost it out",
      body: "Itemised BOQ in INR — by category, by room, by line. Export to CSV, PDF, DXF.",
      icon: <FileSpreadsheet className="size-5" />,
    },
  ];
  return (
    <section id="how" className="container py-20">
      <h2 className="text-3xl md:text-4xl font-semibold text-center tracking-tight">From idea to estimate, in four steps.</h2>
      <p className="mt-3 text-center text-muted-foreground max-w-xl mx-auto">
        No CAD experience needed. The hardest part is deciding what you want.
      </p>
      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {steps.map((s) => (
          <Card key={s.n} className="p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all">
            <div className="size-10 rounded-lg bg-primary/15 text-primary grid place-items-center mb-4">
              {s.icon}
            </div>
            <div className="text-xs font-mono text-muted-foreground mb-1">STEP {s.n}</div>
            <h3 className="text-lg font-semibold">{s.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

function Features() {
  const features = [
    { title: "Editable 2D canvas", body: "Click anything, change anything. Walls, doors, windows, finishes, fixtures." },
    { title: "Real-time 3D",       body: "Konva-fast 2D paired with a Three.js extruded 3D view that updates as you edit." },
    { title: "Deterministic BOQ",  body: "Bricks, cement, sand, doors, windows, finishes, electrical, plumbing — all in INR." },
    { title: "Multi-floor ready",  body: "Layered floors with their own walls, openings, and rooms. Perfect for G+1, G+2." },
    { title: "Plan IR exports",    body: "JSON for re-import, CSV for spreadsheets, PDF for clients, DXF for AutoCAD." },
    { title: "Built for India",    body: "Indian residential proportions, Vastu hints, INR pricing for South-metro markets." },
  ];
  return (
    <section id="features" className="container py-20 border-t border-border/50">
      <h2 className="text-3xl md:text-4xl font-semibold text-center tracking-tight">Everything an architect needs.</h2>
      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((f) => (
          <Card key={f.title} className="p-6">
            <h3 className="text-base font-semibold flex items-center gap-2"><Zap className="size-4 text-primary" />{f.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section id="pricing" className="container py-20">
      <Card className="p-12 md:p-16 text-center bg-gradient-to-br from-primary/15 via-purple-500/10 to-pink-500/10 border-primary/20">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Start drafting in 30 seconds.</h2>
        <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
          No credit card. No CAD installs. Demo mode works without an LLM key.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button size="lg" asChild className="gap-2 text-base h-12 px-7">
            <Link href="/project/new">Generate a plan <ArrowRight className="size-4" /></Link>
          </Button>
        </div>
      </Card>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/40 py-8 mt-auto">
      <div className="container flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LogoMark />
          <span>BluePrintAI</span>
          <span>·</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          Made for the Indian construction industry.
        </div>
      </div>
    </footer>
  );
}

function LogoMark() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" className="text-primary">
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M7 7 L17 7 L17 12 L12 12 L12 17 L7 17 Z" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.2" />
    </svg>
  );
}
