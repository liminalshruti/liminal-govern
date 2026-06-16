// reviewer.mjs — Brief Gate M2: the adversarial reviewer seam (live OR deterministic).
//
// THE INVARIANT (per the M2 build constraint): the reviewer changes HOW the survives/drops decision
// is made — NEVER WHETHER the fail-closed boundary holds. Both reviewers return the SAME verdict
// shape { survives, refuted_by?, reason? }; the gate's boundary code consumes it identically. A
// dropped claim still produces no Judgment → no anchor → no export, regardless of which reviewer ran.
//
//   - LIVE reviewer  → real Opus 4.8 call (forced-tool structured verdict, mirroring engine/enforce.ts).
//                      Used for the demo. Requires ANTHROPIC_API_KEY + @anthropic-ai/sdk.
//   - MOCK reviewer  → the deterministic M1 logic (evidence-contradiction check). Used for the tests,
//                      so the acceptance test ("the dropped claim is NOT anchored") passes with NO
//                      model round-trip.
//
// Selection: live when ANTHROPIC_API_KEY is set AND the SDK loads; deterministic mock otherwise.
// Override `reviewer` explicitly (e.g. in tests) to force a mode.

export const REVIEWER_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

// ── the deterministic mock (the M1 logic; zero deps; the test path) ─────────────────────────────
export function mockReviewer(claim, prEvidence) {
  for (const pr of prEvidence) {
    const subject = pr.refutes_claim_about?.toLowerCase();
    const claimL = claim.text.toLowerCase();
    const assertsWaste = /\b(wast|admin|should not run|belongs on|routine)\b/.test(claimL);
    if (subject && claimL.includes(subject) && assertsWaste) {
      return {
        survives: false,
        refuted_by: pr.pr_id,
        reason: `Refuted by adversarial review: ${pr.pr_id} (${pr.employee}, "${pr.title}") proves the ${subject} work is ${pr.proves}. The claim that it is waste/admin is dropped.`,
      };
    }
  }
  return { survives: true };
}

// ── the live Opus 4.8 reviewer (forced-tool, structured verdict — mirrors engine/enforce.ts) ────
const SYSTEM_PROMPT = `You are the Brief Gate Adversarial Reviewer for AI-generated business briefs.
You are BOUNDED and SKEPTICAL: your sole job is to decide whether a single CLAIM should be allowed to
become operational, by cross-checking it against the supplied EVIDENCE.

Rules:
- A claim SURVIVES only if the evidence does not contradict it. When in doubt, survive (do not invent
  contradictions) — but if a piece of evidence directly refutes the claim, it must be DROPPED.
- You judge the CLAIM, never people. You do not rank, score, or flag individuals.
- Cite the specific evidence id when you drop a claim. Be terse and exact.`;

const RECORD_VERDICT_TOOL = {
  name: "record_verdict",
  description: "Record whether the claim survives adversarial review against the evidence.",
  input_schema: {
    type: "object",
    properties: {
      survives: { type: "boolean", description: "true if the evidence does not refute the claim" },
      refuted_by: { type: ["string", "null"], description: "the evidence id that refutes it, or null" },
      reason: { type: "string", description: "one-sentence rationale; cite the evidence id if dropped" },
    },
    required: ["survives", "reason"],
  },
};

export async function liveReviewer(claim, prEvidence, { client, model = REVIEWER_MODEL } = {}) {
  // Lazy-load the SDK so this module loads even when the SDK is absent (mock path stays runnable).
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const c = client ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const resp = await c.messages.create({
    model,
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    tools: [RECORD_VERDICT_TOOL],
    tool_choice: { type: "tool", name: "record_verdict" }, // force the structured verdict
    messages: [
      {
        role: "user",
        content:
          `CLAIM:\n${claim.text}\n\n` +
          `EVIDENCE:\n${JSON.stringify(prEvidence, null, 2)}\n\n` +
          `Does this claim survive adversarial review? Record your verdict.`,
      },
    ],
  });
  const block = resp.content.find((b) => b.type === "tool_use");
  if (!block) {
    // A reviewer that returns no structured verdict has not reviewed → fail safe to "survives"
    // is WRONG for a gate; fail safe to "dropped" so an unreviewed claim never silently passes.
    return { survives: false, reason: "live reviewer returned no verdict — failing closed (dropped)" };
  }
  const v = block.input;
  return { survives: Boolean(v.survives), refuted_by: v.refuted_by ?? null, reason: v.reason ?? "" };
}

// ── selection: live by default if a key is present, else deterministic mock ─────────────────────
export function pickReviewer(explicit) {
  if (explicit) return explicit; // tests inject mockReviewer; demo can inject liveReviewer
  if (process.env.ANTHROPIC_API_KEY) return liveReviewer;
  return mockReviewer;
}
