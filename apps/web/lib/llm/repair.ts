import { PlanIR } from "@/lib/schema/plan";
import { REPAIR_PROMPT } from "./prompts";

export async function repairPlan(args: {
  plan: PlanIR;
  errors: string[];
  callModel: (userMsg: string) => Promise<PlanIR>;
  maxAttempts?: number;
}): Promise<PlanIR> {
  const { plan, errors, callModel } = args;
  const maxAttempts = args.maxAttempts ?? 2;

  let cur = plan;
  let curErrors = errors;

  for (let i = 0; i < maxAttempts; i++) {
    const userMsg = REPAIR_PROMPT(curErrors, cur);
    const repaired = await callModel(userMsg);
    cur = repaired;
    // Caller re-runs validateInvariants; we just return the latest attempt.
    return cur;
  }

  return cur;
}
