/**
 * Daily-spend kill switch for paid LLM APIs.
 *
 * Tracks token usage per UTC day per provider in-memory. When the cap is
 * exceeded, generateSpec() refuses further LLM calls and falls back to the
 * heuristic parser. Configure caps with env vars:
 *
 *   LLM_DAILY_TOKEN_CAP            — global cap across all providers (default 200_000)
 *   LLM_DAILY_TOKEN_CAP_GEMINI     — per-provider override (optional)
 *   LLM_DAILY_TOKEN_CAP_CLAUDE     — per-provider override (optional)
 *   LLM_DAILY_TOKEN_CAP_OPENAI     — per-provider override (optional)
 *
 * In serverless this resets per cold-start — pair with the provider's billing
 * dashboard alarms (the real spend cap). For one-process deployments this is
 * an effective second line of defence.
 */

type Provider = "gemini" | "claude" | "openai";
const usage = new Map<string, number>(); // key: `${provider}:${YYYY-MM-DD}`

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function capFor(provider: Provider): number {
  const env = process.env;
  const upper = provider.toUpperCase();
  const v = env[`LLM_DAILY_TOKEN_CAP_${upper}`] ?? env.LLM_DAILY_TOKEN_CAP;
  const n = v ? Number(v) : 200_000;
  return Number.isFinite(n) && n > 0 ? n : 200_000;
}

export function tokensUsedToday(provider: Provider): number {
  return usage.get(`${provider}:${todayKey()}`) ?? 0;
}

export function isOverBudget(provider: Provider, plannedTokens = 0): boolean {
  return tokensUsedToday(provider) + plannedTokens >= capFor(provider);
}

export function recordTokenUsage(provider: Provider, tokens: number): void {
  if (!Number.isFinite(tokens) || tokens <= 0) return;
  const k = `${provider}:${todayKey()}`;
  usage.set(k, (usage.get(k) ?? 0) + Math.floor(tokens));
}

/** Snapshot for /api/health debug. */
export function budgetStatus(): Array<{ provider: Provider; used: number; cap: number }> {
  const providers: Provider[] = ["gemini", "claude", "openai"];
  return providers.map((p) => ({ provider: p, used: tokensUsedToday(p), cap: capFor(p) }));
}
