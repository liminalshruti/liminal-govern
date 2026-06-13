/**
 * enforceCap() — the governance-enforcement beat.
 *
 * A BOUNDED agent on Opus that judges spend DECISIONS, never people. Given a ratified monthly cap
 * and a set of decisions, it returns a verdict per decision and REFUSES — with a strict, named
 * refusal protocol — any decision that (a) breaches the cap, (b) falls outside the spend-governance
 * lane, or (c) is actually a request to surveil people. "Governance without surveillance."
 *
 * SDK note: we FORCE the `record_verdict` tool via tool_choice, so we deliberately do NOT enable
 * extended thinking in the same call (the two are incompatible). The agent is bounded to a single
 * structured ruling — no free-form action.
 *
 * The cap is arithmetic, so it is also enforced deterministically: if the model ever approves an
 * over-cap decision, the deterministic guard overrides it to a refusal. Belt and suspenders — the
 * ratified cap is never breached, even on a model wobble.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { EnforcementVerdict, RefusalKind, SpendDecision, Verdict } from "./types.js";

export const ENFORCEMENT_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

const SYSTEM_PROMPT = `You are the Spend-Governance Enforcement Agent for a founder/operator team.
You are BOUNDED: you rule on spend DECISIONS only, and you do not act outside this lane.

GOVERNANCE WITHOUT SURVEILLANCE — your prime directive:
- You judge spend decisions, NEVER people. You never rank, score, monitor, or flag individuals.
- If a "decision" is really a request to surveil, track, or evaluate a person, you REFUSE it with
  refusal_kind "surveillance".

THE RATIFIED CAP is a hard ceiling on committed monthly spend. For each decision:
- If decision.amount EXCEEDS the cap, you REFUSE with refusal_kind "over-cap". No exceptions, no
  "just this once". The cap is the ratified will of the team.
- If the decision is not a spend-governance decision (e.g. hiring, firing, performance, unrelated
  ops), you REFUSE with refusal_kind "out-of-lane".
- Otherwise, if it is an in-lane spend decision within the cap, you APPROVE it with refusal_kind
  "none".

Be terse and concrete in the rationale (one or two sentences). Always cite the cap and the amount.
Record exactly one verdict via the record_verdict tool.`;

const RECORD_VERDICT_TOOL: Anthropic.Tool = {
  name: "record_verdict",
  description: "Record the bounded ruling on a single spend decision.",
  input_schema: {
    type: "object",
    properties: {
      verdict: { type: "string", enum: ["approve", "refuse"] },
      refusal_kind: {
        type: "string",
        enum: ["over-cap", "out-of-lane", "surveillance", "none"],
        description: "The kind of refusal, or 'none' when approving.",
      },
      rationale: { type: "string", description: "One or two terse sentences citing the cap and amount." },
    },
    required: ["verdict", "refusal_kind", "rationale"],
  },
};

/** A model ruling as parsed from the forced tool call. */
export interface ModelRuling {
  verdict: Verdict;
  refusal_kind: RefusalKind;
  rationale: string;
}

/** Pluggable so tests can run the guard logic without the network. */
export type RulingFn = (cap: number, decision: SpendDecision) => Promise<ModelRuling>;

export interface EnforceOptions {
  /** Override the model call (tests / offline). Defaults to a live Opus forced-tool call. */
  ruling?: RulingFn;
  /** Provide a preconfigured SDK client (else one is built from ANTHROPIC_API_KEY). */
  client?: Anthropic;
  model?: string;
}

/** Live Opus ruling: one bounded, forced-tool call (no extended thinking — incompatible). */
export function makeOpusRuling(client: Anthropic, model = ENFORCEMENT_MODEL): RulingFn {
  return async (cap, decision) => {
    const resp = await client.messages.create({
      model,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      tools: [RECORD_VERDICT_TOOL],
      tool_choice: { type: "tool", name: "record_verdict" },
      messages: [
        {
          role: "user",
          content:
            `RATIFIED MONTHLY CAP: $${cap}\n\n` +
            `DECISION TO RULE ON:\n` +
            `- id: ${decision.id}\n` +
            `- description: ${decision.description}\n` +
            `- vendor: ${decision.vendor ?? "(n/a)"}\n` +
            `- claimed lane: ${decision.lane ?? "(unstated)"}\n` +
            `- amount (monthly USD this would commit): $${decision.amount}\n\n` +
            `Rule on it now via record_verdict.`,
        },
      ],
    });
    const block = resp.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") {
      throw new Error("enforceCap: model did not return a record_verdict tool call");
    }
    const input = block.input as { verdict: Verdict; refusal_kind: RefusalKind; rationale: string };
    return { verdict: input.verdict, refusal_kind: input.refusal_kind, rationale: input.rationale };
  };
}

/**
 * Deterministic cap guard: the ratified ceiling is arithmetic and non-negotiable. If the amount
 * exceeds the cap, this returns a refusal regardless of what the model said — the cap cannot be
 * breached by a model wobble. Otherwise the model's ruling stands.
 */
export function applyCapGuard(
  cap: number,
  decision: SpendDecision,
  model: ModelRuling,
  modelName: string,
): EnforcementVerdict {
  const overCap = decision.amount > cap;

  if (overCap) {
    const modelAlsoRefused = model.verdict === "refuse" && model.refusal_kind === "over-cap";
    return {
      decision_id: decision.id,
      verdict: "refuse",
      refusal_kind: "over-cap",
      rationale: modelAlsoRefused
        ? model.rationale
        : `REFUSED: $${decision.amount} exceeds the ratified $${cap} cap. The cap is non-negotiable.`,
      cap,
      amount: decision.amount,
      model: modelName,
      source: modelAlsoRefused ? "opus" : "deterministic-guard",
    };
  }

  return {
    decision_id: decision.id,
    verdict: model.verdict,
    refusal_kind: model.refusal_kind,
    rationale: model.rationale,
    cap,
    amount: decision.amount,
    model: modelName,
    source: "opus",
  };
}

/**
 * Rule on each decision against the ratified cap. Live on Opus by default; deterministically
 * cap-guarded. Returns one EnforcementVerdict per decision, in order.
 */
export async function enforceCap(
  cap: number,
  decisions: SpendDecision[],
  opts: EnforceOptions = {},
): Promise<EnforcementVerdict[]> {
  const model = opts.model ?? ENFORCEMENT_MODEL;
  let ruling = opts.ruling;
  if (!ruling) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("enforceCap: ANTHROPIC_API_KEY not set and no `ruling` override provided");
    }
    const client = opts.client ?? new Anthropic({ apiKey });
    ruling = makeOpusRuling(client, model);
  }

  const verdicts: EnforcementVerdict[] = [];
  for (const decision of decisions) {
    const modelRuling = await ruling(cap, decision);
    verdicts.push(applyCapGuard(cap, decision, modelRuling, model));
  }
  return verdicts;
}
