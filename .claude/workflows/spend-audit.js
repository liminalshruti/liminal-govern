export const meta = {
  name: 'spend-audit',
  description: 'Govern AI spend: classify Opus 4.8 usage against OKRs, deliberate with 8 bounded agents, adversarially refute weak savings claims, anchor the surviving findings + ratified decision to the provenance chain, and verify against rubric.md + tests/. Rerunnable on any usage fixture: /spend-audit on data/usage-events.csv',
  phases: [
    { title: 'Ingest', detail: 'load + summarize the AI-usage governance fixture' },
    { title: 'Deliberate', detail: '8 bounded spend-governance agents (model: opus) read the spend' },
    { title: 'Adversarial review', detail: 'a fresh Read-only reviewer refutes weak claims vs PR evidence' },
    { title: 'Emit + anchor', detail: 'deterministically emit out/report.json + anchor to the provenance chain' },
    { title: 'Verify', detail: 'gate on rubric.md + tests/ — emit success only when all 5 checks pass' },
  ],
}

// ── parse args: "/spend-audit on data/usage-events.csv" → "data/usage-events.csv" ────────────────
const fixture = (typeof args === 'string' ? args : '')
  .replace(/^\s*on\s+/i, '')
  .trim() || 'data/usage-events.csv'

log(`spend-audit → governing AI spend in ${fixture}`)

// ── 1 · Ingest ───────────────────────────────────────────────────────────────────────────────────
phase('Ingest')
const FIXTURE_SCHEMA = {
  type: 'object',
  required: ['opus_total_usd', 'by_category', 'event_count'],
  properties: {
    opus_total_usd: { type: 'number' },
    event_count: { type: 'number' },
    by_category: {
      type: 'array',
      items: {
        type: 'object',
        required: ['category', 'usd'],
        properties: { category: { type: 'string' }, usd: { type: 'number' } },
      },
    },
  },
}
const intake = await agent(
  `Read ${fixture}, data/okr-baseline.json, data/agent-registry.json, and data/pr-evidence.csv in the ` +
  `liminal-govern repo. This is an AI-usage governance fixture: a cohort of engineers using Claude ` +
  `Opus 4.8 against a 60% product / 40% security-hardening OKR baseline. Roll up Opus-4.8 est_cost_usd ` +
  `by task_category and report the total, the per-category split, and the number of usage events. ` +
  `Return structured data only.`,
  { label: 'ingest', phase: 'Ingest', schema: FIXTURE_SCHEMA },
)
if (intake) log(`Opus 4.8 spend $${intake.opus_total_usd} across ${intake.event_count} events`)

// ── 2 · Deliberate — 8 bounded spend-governance agents, each model: opus ─────────────────────────
phase('Deliberate')
const LANES = [
  ['Spend analyst', 'Roll up Opus 4.8 spend by task_category; name the biggest categories and any spend that looks non-core (calendar/admin, generic summarization, unclassified).'],
  ['OKR-alignment', 'Compare actual spend to the 60/40 product/security target. Flag any objective that is under-allocated. Stay in your lane: alignment to OKRs only.'],
  ['Productivity-evidence', 'Cross-reference product_dev spend with data/pr-evidence.csv — which spend is backed by shipped PRs? Refuse to judge security or cost.'],
  ['Security-evidence', 'Cross-reference security_hardening spend with data/security-tickets.csv. Is security under-resourced vs its 40% mandate? Security lane only.'],
  ['Misuse/policy', 'Identify Opus 4.8 usage that does not map to an approved OKR category (calendar_admin, summarization). Propose routing to a cheaper option. Do NOT yet verify the claims — that is the reviewer\'s job.'],
  ['Agent-marketplace evaluator', 'From data/agent-registry.json, identify registry-verified lower-cost agents (CalendarOps, DigestBot) that could absorb the non-core work, with their cost-vs-Opus ratio.'],
  ['Provenance', 'State exactly what must be anchored to the ledger: each surviving finding + the ratified decision, each citing its source rows. Refuse to invent numbers.'],
  ['Exec-comms', 'Draft the one-line ratified policy a founder/operator would sign ("Opus 4.8 cannot be used for calendar management — use the verified CalendarOps Agent"). Decision framing only.'],
]
const reads = await parallel(
  LANES.map(([name, brief]) => () =>
    agent(
      `You are the bounded "${name}" agent in an AI-spend governance deliberation. ${brief}\n\n` +
      `Context: ${fixture} + data/okr-baseline.json + data/agent-registry.json + data/pr-evidence.csv ` +
      `+ data/security-tickets.csv in the liminal-govern repo. Stay strictly within your lane; if a ` +
      `question is out of your lane, say "REFUSE: not my lane → <which agent owns it>". Be concise.`,
      { label: name, phase: 'Deliberate', model: 'opus' },
    ),
  ),
)
log(`${reads.filter(Boolean).length}/8 bounded agents reported`)

// ── 3 · Adversarial review — refute weak claims (must drop the E14 trap) ──────────────────────────
// W1 — this one call runs with EXTENDED THINKING so its refutation reasons harder before it drops a
// claim (the marquee Opus-4.8 hero beat). The Anthropic API forbids forced `tool_choice` while
// extended thinking is on — the exact incompatibility that keeps engine/enforce.ts's forced
// `record_verdict` call thinking-OFF (see enforce.ts:9-10,78). A `schema:` here would force a
// StructuredOutput tool and so DISABLE thinking; to keep the reviewer thinking-capable we drop the
// forced schema, let it deliberate in the open, and parse the verdict it emits. This cannot move the
// E14 drop: determinism is owned by the deterministic core (spend-audit.mjs) + the fail-closed gate,
// not by this live read — the schema relaxation is confined to the narrated reviewer beat.
phase('Adversarial review')

// Parse the reviewer's verdict out of its free-text (thinking-enabled) reply: prefer the last fenced
// ```json block, else the last bare {…} object. Returns null if no well-formed verdict is present.
function parseVerdict(text) {
  if (typeof text !== 'string') return null
  const fenced = [...text.matchAll(/```json\s*([\s\S]*?)```/gi)].map((m) => m[1])
  const bare = text.match(/\{[\s\S]*\}/)
  for (const raw of [...fenced.reverse(), bare ? bare[0] : null]) {
    if (!raw) continue
    try {
      const v = JSON.parse(raw.trim())
      if (Array.isArray(v.dropped) && Array.isArray(v.verdicts)) return v
    } catch { /* try the next candidate */ }
  }
  return null
}

const review = await agent(
  `You are a fresh, skeptical Read-only adversarial reviewer (FinOps auditor) running with EXTENDED ` +
  `THINKING — reason hard, step by step, in the open before you rule. The Misuse/policy agent flagged ` +
  `calendar_admin and summarization Opus-4.8 events as routable waste. REFUTE any claim that does not ` +
  `survive the evidence. Cross-check each flagged event against data/pr-evidence.csv: if a flagged ` +
  `event is backed by a PR on the "product" workstream, the work is real product engineering, NOT ` +
  `admin — the routing/savings claim must be DROPPED. Pay special attention to E14 (labeled ` +
  `calendar_admin but titled "calendar-sync feature"): check whether a product PR (PR-103) proves it ` +
  `is product work. Default to dropping when the evidence is ambiguous.\n\n` +
  `Think through every flagged event explicitly, THEN end your reply with one fenced JSON block (and ` +
  `nothing after it) of exactly this shape:\n` +
  '```json\n' +
  `{"dropped":["E14"],"verdicts":[{"event_id":"E14","claim_survives":false,"reason":"PR-103 proves it is product work"}]}\n` +
  '```',
  // No `schema:` — forced tools are incompatible with extended thinking (see note above).
  { label: 'adversarial-reviewer', phase: 'Adversarial review', model: 'opus' },
)
const verdict = parseVerdict(review)
if (verdict) {
  log(`adversarial review dropped: ${verdict.dropped.join(', ') || '(none)'}`)
  const e14 = verdict.verdicts.find((v) => v.event_id === 'E14')
  if (e14 && !e14.claim_survives) log(`✓ caught its own error: E14 dropped — ${e14.reason}`)
}

// ── 4 · Emit + anchor — deterministic report.json + real provenance chain ────────────────────────
phase('Emit + anchor')
const emit = await agent(
  `Run exactly this command from the liminal-govern repo root and paste its full stdout:\n` +
  `  node .claude/workflows/spend-audit.mjs ${fixture}\n` +
  `This deterministically classifies every usage event, applies the adversarial drop (E14 via PR-103), ` +
  `anchors the surviving findings + the ratified decision into the provenance chain, and writes ` +
  `out/report.json. Do not edit any files; just run it and report the output.`,
  { label: 'emit-report', phase: 'Emit + anchor' },
)

// ── 5 · Verify — gate on rubric.md + tests/ ──────────────────────────────────────────────────────
phase('Verify')
const verify = await agent(
  `Run "npm test" in the liminal-govern repo and report the result. The S4 done-gate passes only when ` +
  `all checks are green (expected: 12 pass, 0 fail, 0 skip), including "S4 report satisfies the 5 ` +
  `rubric checks" and "surviving findings reconcile to $284 ±$1". If anything fails or skips, say NOT ` +
  `DONE and quote the failing assertion. Otherwise say "S4 ✅ — gate green".`,
  { label: 'verify-gate', phase: 'Verify' },
)

return {
  fixture,
  intake,
  deliberation: reads.filter(Boolean).length,
  adversarial: verdict,
  emit,
  verify,
}
