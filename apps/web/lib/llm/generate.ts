import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import { PlanIR } from "@/lib/schema/plan";
import { validateInvariants } from "@/lib/schema/validate";
import { SYSTEM_PROMPT, buildUserMessage } from "./prompts";
import { repairPlan } from "./repair";
import { buildDemoPlan } from "./demo";

export type GenerateArgs = {
  prompt: string;
  meta: PlanIR["meta"];
  currentPlan?: PlanIR;
};

export type GenerateResult = {
  plan: PlanIR;
  source: "gemini" | "claude" | "demo";
  attempts: number;
  warnings: string[];
};

export async function generatePlan(args: GenerateArgs): Promise<GenerateResult> {
  const warnings: string[] = [];
  const userMsg = buildUserMessage({
    prompt: args.prompt,
    meta: args.meta,
    currentPlan: args.currentPlan,
  });

  // Demo fallback when no keys are set: synthesize a plan procedurally.
  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasClaude = !!process.env.ANTHROPIC_API_KEY;
  if (!hasGemini && !hasClaude) {
    const plan = buildDemoPlan({ prompt: args.prompt, meta: args.meta });
    const inv = validateInvariants(plan);
    if (!inv.ok) {
      throw new Error("Demo plan failed validation: " + inv.errors.join("; "));
    }
    return { plan, source: "demo", attempts: 0, warnings: ["LLM keys not configured — used demo plan"] };
  }

  // Attempt with Gemini up to 2 times.
  if (hasGemini) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const plan = await callGemini(userMsg);
        const inv = validateInvariants(plan);
        if (inv.ok) return { plan, source: "gemini", attempts: attempt, warnings };

        // Try repair once.
        const repaired = await repairPlan({
          plan,
          errors: inv.errors,
          callModel: callGemini,
        });
        const inv2 = validateInvariants(repaired);
        if (inv2.ok) {
          warnings.push(`Gemini plan needed 1 repair pass (${inv.errors.length} errors)`);
          return { plan: repaired, source: "gemini", attempts: attempt, warnings };
        }
      } catch (e) {
        warnings.push(`Gemini attempt ${attempt} failed: ${(e as Error).message}`);
      }
    }
  }

  // Fallback: Claude.
  if (hasClaude) {
    try {
      const plan = await callClaude(userMsg);
      const inv = validateInvariants(plan);
      if (inv.ok) return { plan, source: "claude", attempts: 1, warnings };
      const repaired = await repairPlan({
        plan,
        errors: inv.errors,
        callModel: callClaude,
      });
      const inv2 = validateInvariants(repaired);
      if (inv2.ok) {
        warnings.push("Claude plan needed 1 repair pass");
        return { plan: repaired, source: "claude", attempts: 1, warnings };
      }
      throw new Error("Claude plan failed validation after repair: " + inv2.errors.join("; "));
    } catch (e) {
      warnings.push(`Claude failed: ${(e as Error).message}`);
    }
  }

  // Last resort: demo.
  const plan = buildDemoPlan({ prompt: args.prompt, meta: args.meta });
  warnings.push("All LLM attempts failed — falling back to demo plan");
  return { plan, source: "demo", attempts: 0, warnings };
}

// ---------- model callers ----------

async function callGemini(userMsg: string): Promise<PlanIR> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  const genai = new GoogleGenerativeAI(apiKey);
  const model = genai.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
    systemInstruction: SYSTEM_PROMPT,
  });
  const r = await model.generateContent(userMsg);
  const text = r.response.text();
  return PlanIR.parse(JSON.parse(text));
}

async function callClaude(userMsg: string): Promise<PlanIR> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const anthropic = new Anthropic({ apiKey });
  const r = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMsg }],
  });
  const text = r.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const json = extractJson(text);
  return PlanIR.parse(JSON.parse(json));
}

function extractJson(text: string): string {
  // Strip markdown fences if any.
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    const inner = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    return inner.trim();
  }
  // Otherwise find first { ... last }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first === -1 || last === -1) return trimmed;
  return trimmed.slice(first, last + 1);
}
