import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const TIERS = [
  {
    name: "Free",
    price: "₹ 0",
    sub: "for trying it out",
    bullets: ["2 projects", "Watermarked exports", "BOQ in INR", "Demo mode (no API key)"],
    cta: { label: "Start free", href: "/project/new" },
    accent: false,
  },
  {
    name: "Pro",
    price: "₹ 999",
    sub: "/ month",
    bullets: ["Unlimited projects", "PDF, DXF, JSON exports", "Vector floor plan exports", "Email support"],
    cta: { label: "Get Pro", href: "/project/new" },
    accent: true,
  },
  {
    name: "Studio",
    price: "₹ 2,999",
    sub: "/ month",
    bullets: ["Everything in Pro", "Up to 5 team members", "Shared materials library", "Priority support"],
    cta: { label: "Contact sales", href: "mailto:hello@blueprintai.in" },
    accent: false,
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border-subtle backdrop-blur sticky top-0 z-30 bg-base/80">
        <div className="container flex h-12 items-center justify-between">
          <Link href="/" className="display font-semibold inline-flex items-baseline" style={{ letterSpacing: "-0.02em" }}>
            BluePrint<span className="text-accent font-bold ml-px" style={{ fontSize: "60%" }}>AI</span>
          </Link>
          <nav className="text-sm text-secondary flex items-center gap-6">
            <Link href="/dashboard" className="hover:text-primary">Dashboard</Link>
            <Link href="/project/new" className="hover:text-primary">Editor</Link>
          </nav>
        </div>
      </header>

      <main className="container py-20 max-w-5xl">
        <h1 className="display text-2xl md:text-3xl font-semibold tracking-tight">Pricing</h1>
        <p className="mt-3 text-secondary max-w-xl">
          Simple, transparent. Cancel anytime. INR pricing — GST included.
        </p>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-3">
          {TIERS.map((t) => (
            <Card
              key={t.name}
              className={`p-6 relative ${t.accent ? "border-accent" : ""}`}
              surface={t.accent ? 2 : 1}
            >
              {t.accent && (
                <span className="absolute top-3 right-3 mono text-2xs uppercase tracking-wider text-accent">Recommended</span>
              )}
              <h2 className="text-base font-medium text-primary">{t.name}</h2>
              <div className="display text-2xl font-semibold tabular-nums mt-3 flex items-baseline gap-1">
                <span>{t.price}</span>
                <span className="text-xs text-secondary font-normal">{t.sub}</span>
              </div>
              <ul className="mt-6 space-y-2">
                {t.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-secondary">
                    <Check className="size-3.5 text-accent mt-1 shrink-0" /> {b}
                  </li>
                ))}
              </ul>
              <Button
                asChild
                variant={t.accent ? "primary" : "secondary"}
                size="md"
                className="w-full mt-8 gap-1.5 justify-center"
              >
                <Link href={t.cta.href}>{t.cta.label} <ArrowRight className="size-3.5" /></Link>
              </Button>
            </Card>
          ))}
        </div>

        <div className="mt-16 mono text-xs text-tertiary">
          Razorpay billing. INR-priced. We never store your card details — payments are processed directly by Razorpay.
        </div>
      </main>
    </div>
  );
}
