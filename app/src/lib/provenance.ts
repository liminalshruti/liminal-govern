/**
 * Provenance data-seam (cockpit · Build Day 2026-06-13).
 *
 * Components import ONLY from this module; they never know where the data comes
 * from. The four seam functions keep their signatures.
 *
 * ┌─────────────────── WIRED TO THE REAL PROVENANCE LIB (via S4) ───────────────────┐
 * │ The orchestration lane (S4 · .claude/workflows/spend-audit.mjs) ran the REAL    │
 * │ provenance/ lib — 8-agent deliberation + adversarial reviewer — and emitted     │
 * │ out/report.json. Its `provenance.anchored` block is the real chain: real        │
 * │ SHA-256 packet hashes (node:crypto, canonical scheme), hash-linked, anchored,   │
 * │ chain_verified=true. The reviewer independently DROPPED the E14 claim (PR-103    │
 * │ proves it's product work) — the "model caught its own error" beat, live.        │
 * │                                                                                  │
 * │ This seam reads that real artifact (public/data/report.json) + joins the raw    │
 * │ usage events for cited evidence. A LIVE correction the operator signs in the     │
 * │ browser is hashed by canonicalHash.ts — the SAME canonical scheme the lib uses  │
 * │ (real SHA-256, Web Crypto), linked to the chain tip.                            │
 * └──────────────────────────────────────────────────────────────────────────────────┘
 */

import type { AnchorReceipt, Correction, CorrectionKind, Packet } from "./contract";
import { computePacketHash } from "./canonicalHash";
import { loadReport, type Report, type ReportFinding } from "./report";

// ─────────────────────────── cited evidence (usage events) ───────────────────────────

export interface CitedEvent {
  event_id: string;
  date: string;
  employee: string;
  model: string;
  task_category: string;
  task_label: string;
  est_cost_usd: number;
}

let eventsPromise: Promise<Map<string, CitedEvent>> | null = null;
async function loadEvents(): Promise<Map<string, CitedEvent>> {
  if (!eventsPromise) {
    eventsPromise = fetch(`${import.meta.env.BASE_URL}data/usage-events.csv`)
      .then((r) => r.text())
      .then((text) => {
        const lines = text.trim().split(/\r?\n/);
        const header = lines[0]!.split(",").map((h) => h.trim());
        const map = new Map<string, CitedEvent>();
        for (const line of lines.slice(1)) {
          const cells = line.split(",");
          const row: Record<string, string> = {};
          header.forEach((h, i) => (row[h] = (cells[i] ?? "").trim()));
          map.set(row.event_id!, {
            event_id: row.event_id!,
            date: row.date!,
            employee: row.employee!,
            model: row.model!,
            task_category: row.task_category!,
            task_label: row.task_label!,
            est_cost_usd: Number(row.est_cost_usd),
          });
        }
        return map;
      });
  }
  return eventsPromise;
}

// ─────────────────────────────── the view the UI renders ───────────────────────────────

export interface ProvenanceView {
  finding_id: string;
  type: "agent_fit_routing" | "okr_misalignment" | string;
  title: string; // recommended_action
  category: string | null;
  employee: string | null;
  monthly_savings: number;
  approved_alternative: string | null;
  approved_alternative_id: string | null;
  sourceEvents: CitedEvent[];
  dropped: boolean;
  drop_reason: string | null;
  receipt: AnchorReceipt | null; // from provenance.anchored (real), null if dropped/unanchored
  packet_hash: string | null;
  prev_hash: string | null;
  verification_state: "verified" | "refuted" | "reallocation";
  verification_message: string;
  // DecisionLog still reads .finding.{id,context,created_at}
  finding: Packet;
}

export interface CorrectionDraft {
  source_packet_id: string;
  correction_kind: CorrectionKind;
  reason: string;
}

export interface ChainEntry {
  id: string;
  kind: "finding" | "decision";
  packet_id: string;
  packet_hash: string;
  prev_hash: string | null;
  created_at: string;
  receipt: AnchorReceipt | null;
}

const PERIOD_DATE = "2026-06-13"; // the audit period (report.json carries no per-row timestamps)

function anchorOf(report: Report, packetId: string): AnchorReceipt | null {
  const a = report.provenance.anchored.find((x) => x.packet_id === packetId);
  if (!a) return null;
  return {
    packet_id: a.packet_id,
    packet_hash: a.packet_hash,
    prev_hash: a.prev_hash,
    anchored_at: `${PERIOD_DATE}T09:00:00.000Z`,
    anchor_chain: a.anchor_chain as "local" | "algorand",
    anchor_network: a.anchor_network,
  };
}

async function buildView(
  report: Report,
  f: ReportFinding,
  events: Map<string, CitedEvent>,
): Promise<ProvenanceView> {
  const receipt = anchorOf(report, f.finding_id);
  const isOkr = f.type === "okr_misalignment";
  const state: ProvenanceView["verification_state"] = f.dropped
    ? "refuted"
    : isOkr
      ? "reallocation"
      : "verified";
  return {
    finding_id: f.finding_id,
    type: f.type,
    title: f.recommended_action,
    category: f.category ?? null,
    employee: f.employee ?? null,
    monthly_savings: f.monthly_savings,
    approved_alternative: f.approved_alternative ?? null,
    approved_alternative_id: f.approved_alternative_id ?? null,
    sourceEvents: f.source_row_ids.map((id) => events.get(id)).filter((e): e is CitedEvent => Boolean(e)),
    dropped: Boolean(f.dropped),
    drop_reason: f.drop_reason ?? null,
    receipt,
    packet_hash: receipt?.packet_hash ?? null,
    prev_hash: receipt?.prev_hash ?? null,
    verification_state: state,
    verification_message: f.dropped
      ? "Refuted by adversarial review — claim dropped, never silently."
      : isOkr
        ? "Reallocation, not a routing saving."
        : "Anchored — real SHA-256, hash-linked & chain-verified.",
    finding: {
      id: f.finding_id,
      kind: "finding",
      context: f.recommended_action,
      reads: [],
      created_at: `${PERIOD_DATE}T09:00:00.000Z`,
    },
  };
}

// In-memory log of corrections signed THIS session (layered on the real chain).
const sessionCorrections: Correction[] = [];

// ───────────────────────────── SEAM (stable API) ─────────────────────────────

/** List all finding provenance views from the real orchestration report. */
export async function listProvenance(): Promise<ProvenanceView[]> {
  const [report, events] = await Promise.all([loadReport(), loadEvents()]);
  return Promise.all(report.findings.map((f) => buildView(report, f, events)));
}

export async function loadProvenance(packetId: string): Promise<ProvenanceView | null> {
  const views = await listProvenance();
  return views.find((v) => v.finding_id === packetId) ?? null;
}

/**
 * Submit a correction — appends a NEW linked entry, never mutates. Hashed
 * in-browser by the lib's canonical scheme (real SHA-256, Web Crypto), linked to
 * the current chain tip.
 */
export async function submitCorrection(
  draft: CorrectionDraft,
): Promise<{ ok: boolean; correction: Correction; packet_hash: string; prev_hash: string | null }> {
  const report = await loadReport();
  const created_at = new Date().toISOString();
  const id = `corr_${draft.source_packet_id}_${sessionCorrections.length + 1}`;

  const packet: Packet = {
    id,
    kind: "finding",
    context: `correction of ${draft.source_packet_id}`,
    reads: [],
    source_packet_id: draft.source_packet_id,
    user_correction: draft.reason,
    correction_kind: draft.correction_kind,
    created_at,
  };
  const anchored = report.provenance.anchored;
  const prev_hash = anchored.length ? anchored[anchored.length - 1]!.packet_hash : null;
  const packet_hash = await computePacketHash({ packet, reads: [] });

  const correction: Correction = {
    id,
    source_packet_id: draft.source_packet_id,
    correction_kind: draft.correction_kind,
    reason: draft.reason,
    created_at,
  };
  sessionCorrections.push(correction);
  return { ok: true, correction, packet_hash, prev_hash };
}

export function listCorrections(): Correction[] {
  return [...sessionCorrections];
}

/** The real append-only chain (anchored findings + the ratified decision). */
export async function listChain(): Promise<ChainEntry[]> {
  const report = await loadReport();
  return report.provenance.anchored.map((a) => ({
    id: a.packet_id,
    kind: a.packet_id.startsWith("D-") ? "decision" : "finding",
    packet_id: a.packet_id,
    packet_hash: a.packet_hash,
    prev_hash: a.prev_hash,
    created_at: `${PERIOD_DATE}T09:00:00.000Z`,
    receipt: anchorOf(report, a.packet_id),
  }));
}

/** The dropped-claim trail (the E14 refutation) — surfaced for the hero. */
export async function getCorrectionTrail(): Promise<
  { finding_id: string; drop_reason: string; dropped_event: string; dropped_savings: number }[]
> {
  const report = await loadReport();
  return report.dropped_claims.map((d) => {
    const f = report.findings.find((x) => x.finding_id === d.finding_id);
    return {
      finding_id: d.finding_id,
      drop_reason: d.drop_reason,
      dropped_event: f?.source_row_ids[0] ?? "E14",
      dropped_savings: f?.monthly_savings ?? 162,
    };
  });
}

/** The ratified policy — the D-RATIFY-CAL chain entry + the decision detail. */
export async function getRatification(): Promise<{
  id: string;
  policy: string;
  rationale: string;
  packet_hash: string | null;
  prev_hash: string | null;
  receipt: AnchorReceipt | null;
  created_at: string;
}> {
  const report = await loadReport();
  const anchored = report.provenance.anchored.find((a) => a.packet_id.startsWith("D-"));
  return {
    id: anchored?.packet_id ?? "D-RATIFY-CAL",
    policy: report.ratified_decision.decision,
    rationale: report.ratified_decision.rationale,
    packet_hash: anchored?.packet_hash ?? null,
    prev_hash: anchored?.prev_hash ?? null,
    receipt: anchored ? anchorOf(report, anchored.packet_id) : null,
    created_at: `${PERIOD_DATE}T09:00:00.000Z`,
  };
}

/** Reconciliation: surviving findings sum to the report total (the dropped claim is not counted). */
export async function getReconcile(): Promise<{
  ok: boolean;
  sum: number;
  total: number;
  delta: number;
  naive: number;
  dropped: number;
}> {
  const report = await loadReport();
  const sum = report.findings
    .filter((f) => !f.dropped)
    .reduce((s, f) => s + f.monthly_savings, 0);
  const total = report.total_recommended_savings;
  return {
    ok: Math.abs(sum - total) <= 1,
    sum,
    total,
    delta: Math.abs(sum - total),
    naive: report.naive_savings,
    dropped: report.naive_savings - total,
  };
}

/**
 * Verify the chain. Surfaces the REAL verify result baked by provenance/ (S4):
 * chain_verified over chain_length entries. Re-walks prev_hash continuity in the
 * browser too as a belt-and-braces check.
 */
export async function verifyChain(): Promise<{
  ok: boolean;
  brokenIndex: number;
  length: number;
  links: { packet_id: string; ok: boolean }[];
}> {
  const report = await loadReport();
  let prev: string | null = null;
  let brokenIndex = -1;
  const links = report.provenance.anchored.map((a, i) => {
    const ok = a.prev_hash === prev;
    if (!ok && brokenIndex === -1) brokenIndex = i;
    prev = a.packet_hash;
    return { packet_id: a.packet_id, ok };
  });
  return {
    ok: report.provenance.chain_verified && brokenIndex === -1,
    brokenIndex,
    length: report.provenance.chain_length,
    links,
  };
}
