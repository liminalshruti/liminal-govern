// extractor.mjs — Brief Gate M4: the claim-extraction seam (live AI OR deterministic parser).
//
// Same pattern as reviewer.mjs: the extractor changes HOW claims are pulled from a brief — never the
// downstream loop (correction → ratification → seal). Both return the SAME shape: an array of
// { id, text, state: "candidate" }.
//
//   - liveExtractor → real Opus 4.8 call: reads a FREE-FORM brief (prose, no numbered list) and
//                     surfaces 5–10 candidate claims via a forced tool. Used for the demo.
//   - parserExtractor → the deterministic M1 parser (numbered "1. … 2. …" list). The test path —
//                       extraction is deterministic so the acceptance tests need no model round-trip.
//
// Selection: live when ANTHROPIC_API_KEY is set, deterministic parser otherwise (override-able).

export const EXTRACTOR_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

// ── the deterministic parser (the M1 logic; zero deps; the test path) ───────────────────────────
export function parserExtractor(briefText) {
  const claims = [];
  const re = /^\s*(\d+)\.\s+(.+?)(?=\n\s*\d+\.\s|\n*$)/gms;
  let m;
  while ((m = re.exec(briefText)) !== null) {
    const body = m[2].replace(/\s+/g, " ").trim();
    claims.push({ id: `C${m[1]}`, text: body, state: "candidate" });
  }
  return claims;
}

// ── the live Opus 4.8 extractor (forced-tool, structured claim list; free-form briefs) ──────────
const SYSTEM_PROMPT = `You extract the discrete, checkable CLAIMS from an AI-generated business brief.
A claim is a single assertion an executive might act on or report (a saving, a recommendation, a
risk, a status). Extract 5–10 claims maximum. Do NOT summarize, editorialize, or merge claims —
pull each as the brief states it. Output via the record_claims tool only.`;

const RECORD_CLAIMS_TOOL = {
  name: "record_claims",
  description: "Record the discrete claims extracted from the brief.",
  input_schema: {
    type: "object",
    properties: {
      claims: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "a short stable id, e.g. C1, C2" },
            text: { type: "string", description: "the claim, as the brief states it" },
          },
          required: ["id", "text"],
        },
      },
    },
    required: ["claims"],
  },
};

export async function liveExtractor(briefText, { client, model = EXTRACTOR_MODEL } = {}) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const c = client ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const resp = await c.messages.create({
    model,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [RECORD_CLAIMS_TOOL],
    tool_choice: { type: "tool", name: "record_claims" },
    messages: [{ role: "user", content: `BRIEF:\n${briefText}\n\nExtract the claims.` }],
  });
  const block = resp.content.find((b) => b.type === "tool_use");
  if (!block || !Array.isArray(block.input?.claims)) {
    // No structured extraction → fall back to the deterministic parser rather than silently
    // dropping the whole brief (an empty extraction would let everything "pass" by vacuity).
    return parserExtractor(briefText);
  }
  return block.input.claims.map((c, i) => ({
    id: c.id || `C${i + 1}`,
    text: String(c.text || "").trim(),
    state: "candidate",
  }));
}

export function pickExtractor(explicit) {
  if (explicit) return explicit;
  if (process.env.ANTHROPIC_API_KEY) return liveExtractor;
  return parserExtractor;
}
