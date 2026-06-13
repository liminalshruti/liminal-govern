/**
 * Provenance data-seam (cockpit · Build Day 2026-06-13).
 *
 * Components import ONLY from this module; they never know where the data comes
 * from. The exported functions (listProvenance / loadProvenance / submitCorrection /
 * listCorrections / verifyChain) keep stable signatures.
 *
 * ┌──────────────────── REAL S4 AI-SPEND OUTPUT, ANCHORED & BAKED AT BUILD TIME ────────────────────┐
 * │ Findings come from the S4 orchestration report (`out/report.json` — the 8-agent deliberation     │
 * │ + adversarial reviewer over Opus 4.8 usage): the agent-fit routings, the OKR misalignment, and   │
 * │ the DROPPED E14 claim (PR-103 proved it was product work). `app/scripts/generate-findings.mjs`   │
 * │ wraps each as a finding Packet, anchors the surviving findings + the ratified decision to the     │
 * │ REAL local-first provenance chain (`../../provenance`, better-sqlite3 + node:crypto → real        │
 * │ SHA-256 receipts hash-linked), and bakes them into `src/generated/engine-findings.json`.         │
 * │                                                                                                  │
 * │ This module loads THAT file. The browser RE-VERIFIES every packet_hash with WebCrypto via        │
 * │ ./chain.ts (mirrors the provenance hash scheme byte-for-byte), so the green badge is an          │
 * │ independent confirmation, not a re-assertion. Corrections append as NEW linked entries on top.   │
 * └──────────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import engineFindings from "../generated/engine-findings.json";
import type {
  AnchorReceipt,
  Correction,
  CorrectionKind,
  Packet,
  SavingsFinding,
} from "./contract";
import {
  appendCorrection,
  buildChain,
  correctionsFor,
  listPersistedCorrections,
  verifyChain as verifyEvents,
} from "./chain";

/** One cited usage event behind a finding (the AI-spend evidence). */
export interface SourceEvent {
  event_id: string;
  date: string;
  employee: string;
  task_label: string;
  task_category: string;
  est_cost_usd: number;
}

interface GeneratedFinding {
  savings: SavingsFinding;
  type: "agent_fit_routing" | "okr_misalignment" | string;
  category: string | null;
  employee: string | null;
  approved_alternative: string | null;
  approved_alternative_id: string | null;
  dropped: boolean;
  drop_reason: string | null;
  packet: Packet;
  receipt: AnchorReceipt | null;
  sourceEvents: SourceEvent[];
}

export interface CategorySpend {
  category: string;
  usd: number;
  pct: number;
}

export interface RatifiedDecision {
  decision: string;
  rationale: string;
  approved_alternative: string;
  approved_by: string;
  effective_period: string;
  referenced_context: string[];
  agent_policy: { opus_4_8_allowed_for: string[]; opus_4_8_disallowed_for: string[] };
  packet_id: string;
  packet: Packet;
  receipt: AnchorReceipt;
}

interface GeneratedData {
  fixture: string;
  dataset: string;
  generated_for: string;
  governed_model: string;
  opus_total: number;
  rows_analyzed: number;
  naive_savings: number;
  monthly_savings_total: number;
  dropped_total: number;
  reconcile: { ok: boolean; sum: number; total: number; delta: number; tolerance: number };
  chain_verified: boolean;
  chain_length: number;
  anchored_at: string;
  okr: {
    security_actual_pct: number;
    security_target_pct: number;
    objectives: { id: string; name: string; target_pct: number; categories: string[] }[];
  };
  category_spend: CategorySpend[];
  ratified_decision: RatifiedDecision;
  findings: GeneratedFinding[];
}

/** The build-time engine output. Typed through the contract shapes. */
const ENGINE = engineFindings as unknown as GeneratedData;

/** Anchored findings (exclude the dropped/refuted ones) — the cockpit chain order. */
const anchoredFindings = ENGINE.findings.filter((f) => !f.dropped);

/** The deterministic chain packets, in anchored order: findings then the ratified decision. */
function basePackets(): Packet[] {
  return [...anchoredFindings.map((f) => f.packet), ENGINE.ratified_decision.packet];
}

/** Headline figures straight from the S4 report (reconciled, evidence-backed). */
export const engineReport = {
  fixture: ENGINE.fixture,
  dataset: ENGINE.dataset,
  generated_for: ENGINE.generated_for,
  governed_model: ENGINE.governed_model,
  opus_total: ENGINE.opus_total,
  rows_analyzed: ENGINE.rows_analyzed,
  naive_savings: ENGINE.naive_savings,
  monthly_savings_total: ENGINE.monthly_savings_total,
  dropped_total: ENGINE.dropped_total,
  reconcile: ENGINE.reconcile,
  chain_length: ENGINE.chain_length,
};

export const categorySpend: CategorySpend[] = ENGINE.category_spend;
export const okrData = ENGINE.okr;

/** The unit the provenance surface renders: a finding, its receipt, its verify state. */
export interface ProvenanceView {
  finding: Packet; // kind === "finding"
  savings: SavingsFinding;
  type: string;
  category: string | null;
  employee: string | null;
  approved_alternative: string | null;
  approved_alternative_id: string | null;
  dropped: boolean;
  drop_reason: string | null;
  sourceEvents: SourceEvent[];
  receipt: AnchorReceipt | null;
  corrections: Correction[];
  verification_state: "verified" | "refuted" | "tampered";
  verification_message: string;
}

export interface CorrectionDraft {
  source_packet_id: string;
  correction_kind: CorrectionKind;
  reason: string;
}

// ───────────────────────────── SEAM (stable API) ─────────────────────────────

/**
 * List all finding provenance views. Builds the live chain from the anchored
 * packets (+ persisted corrections) and re-verifies it in-browser. Surviving
 * findings show their engine receipt cross-checked against the browser-recomputed
 * hash; the dropped finding is shown refuted (never anchored).
 */
export async function listProvenance(): Promise<ProvenanceView[]> {
  const events = await buildChain(basePackets());
  const report = await verifyEvents(events);
  const linkOk = new Map(report.links.map((l) => [l.packet_id, l.ok]));
  const browserHashById = new Map(events.map((e) => [e.packet_id, e.packet_hash]));

  return ENGINE.findings.map((f) => {
    const corrections = correctionsFor(f.packet.id);
    if (f.dropped) {
      return {
        finding: f.packet,
        savings: f.savings,
        type: f.type,
        category: f.category,
        employee: f.employee,
        approved_alternative: f.approved_alternative,
        approved_alternative_id: f.approved_alternative_id,
        dropped: true,
        drop_reason: f.drop_reason,
        sourceEvents: f.sourceEvents,
        receipt: null,
        corrections,
        verification_state: "refuted",
        verification_message:
          "Refuted by adversarial review — claim dropped, recorded but never anchored.",
      };
    }
    const hashMatches = browserHashById.get(f.packet.id) === f.receipt?.packet_hash;
    const linked = linkOk.get(f.packet.id) ?? false;
    const ok = hashMatches && linked;
    return {
      finding: f.packet,
      savings: f.savings,
      type: f.type,
      category: f.category,
      employee: f.employee,
      approved_alternative: f.approved_alternative,
      approved_alternative_id: f.approved_alternative_id,
      dropped: false,
      drop_reason: null,
      sourceEvents: f.sourceEvents,
      receipt: f.receipt,
      corrections,
      verification_state: ok ? "verified" : "tampered",
      verification_message: ok
        ? `Engine-anchored SHA-256, re-verified in-browser${
            corrections.length ? ` · ${corrections.length} correction(s) re-anchored` : ""
          }.`
        : "Chain link/hash mismatch — engine receipt did not re-verify in-browser.",
    };
  });
}

export async function loadProvenance(packetId: string): Promise<ProvenanceView | null> {
  const views = await listProvenance();
  return views.find((v) => v.finding.id === packetId) ?? null;
}

/** The ratified policy (anchored as the final chain entry). */
export function getRatification(): RatifiedDecision {
  return ENGINE.ratified_decision;
}

/**
 * Submit a correction against a finding — appends a NEW linked entry to the
 * browser-native chain on top of the engine's anchored findings (never mutates),
 * persists it to localStorage, and re-anchors on the next chain build.
 */
export async function submitCorrection(
  draft: CorrectionDraft,
): Promise<{ ok: boolean; correction: Correction }> {
  const correction = appendCorrection(draft);
  return { ok: true, correction };
}

/** Corrections appended to the chain (persisted; drives the decision log). */
export function listCorrections(): Correction[] {
  return listPersistedCorrections();
}

/**
 * Verify the live chain links cleanly — each row re-hashes to its recorded
 * `packet_hash` AND each `prev_hash` matches the previous row's `packet_hash`.
 * Returns a per-link report (anchored findings + ratified decision + corrections).
 */
export async function verifyChain(): Promise<{
  ok: boolean;
  links: { packet_id: string; ok: boolean }[];
}> {
  const events = await buildChain(basePackets());
  const report = await verifyEvents(events);
  return { ok: report.ok, links: report.links };
}
