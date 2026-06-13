/**
 * Provenance data-seam (cockpit · Build Day 2026-06-13).
 *
 * Components import ONLY from this module; they never know where the data comes
 * from. The exported functions (listProvenance / loadProvenance / submitCorrection /
 * listCorrections / verifyChain) keep stable signatures.
 *
 * ┌──────────────────────── REAL ENGINE OUTPUT, BAKED AT BUILD TIME ────────────────────────┐
 * │ Findings are NOT derived in the browser anymore. They are produced by the Node engine    │
 * │ (`../../engine`): analyze() recomputes seat utilization from the `data/` fixtures into    │
 * │ SavingsFinding[], and anchorFindings() commits each one to the local-first provenance     │
 * │ chain (`../../provenance`, better-sqlite3 + node:crypto), minting a real SHA-256          │
 * │ AnchorReceipt hash-linked to the previous entry. `app/scripts/generate-findings.mjs`      │
 * │ runs that engine at build time and bakes the findings + the exact hashed packets + the    │
 * │ receipts into `src/generated/engine-findings.json` (see prebuild hook).                   │
 * │                                                                                           │
 * │ This module loads THAT file. The browser then RE-VERIFIES every engine packet_hash with   │
 * │ WebCrypto via ./chain.ts — which mirrors the provenance hash scheme byte-for-byte — so    │
 * │ the green badge is an independent in-browser confirmation of the engine's anchoring, not  │
 * │ a re-assertion. Corrections are appended as NEW linked entries on top of the engine's     │
 * │ anchored chain (never mutations), persisted across reloads, and the chain re-verifies     │
 * │ live after each one.                                                                      │
 * └───────────────────────────────────────────────────────────────────────────────────────┘
 *
 * CONTRACT ALIGNMENT (src/lib/contract.ts, mirrored from coordination/contract.ts):
 *   - ProvenanceView.finding  ↔ Packet (kind === "finding")  — the exact packet the engine hashed
 *   - ProvenanceView.receipt  ↔ AnchorReceipt                — the engine-minted receipt
 *   - submitCorrection payload ↔ Correction
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

/** One cited evidence row behind a finding (engine UtilizationRow projection). */
export interface EvidenceRow {
  row_id: string;
  vendor: string;
  plan: string;
  seats_purchased: number;
  active_seats_30d: number;
  monthly_cost: number;
  per_seat_cost: number;
  utilization_pct: number;
}

interface GeneratedFinding {
  savings: SavingsFinding;
  packet: Packet; // the exact packet the engine canonical-hashed
  receipt: AnchorReceipt; // the engine-minted, hash-linked receipt
  sourceRows: EvidenceRow[];
}

interface GeneratedData {
  fixture: string;
  generated_for: string;
  rows_analyzed: number;
  monthly_savings_total: number;
  reconcile: { ok: boolean; sum: number; total: number; delta: number; tolerance: number };
  chain_verified: boolean;
  chain_length: number;
  anchored_at: string;
  findings: GeneratedFinding[];
}

/** The build-time engine output. Typed through the contract shapes. */
const ENGINE = engineFindings as unknown as GeneratedData;

/** The deterministic engine packets, in anchored (chain) order. */
function basePackets(): Packet[] {
  return ENGINE.findings.map((f) => f.packet);
}

/** Headline figures straight from the engine report (reconciled, evidence-backed). */
export const engineReport = {
  fixture: ENGINE.fixture,
  generated_for: ENGINE.generated_for,
  rows_analyzed: ENGINE.rows_analyzed,
  monthly_savings_total: ENGINE.monthly_savings_total,
  reconcile: ENGINE.reconcile,
};

/** The unit the provenance surface renders: a finding, its receipt, its verify state. */
export interface ProvenanceView {
  finding: Packet; // kind === "finding"
  savings: SavingsFinding; // the structured spend finding behind the packet
  sourceRows: EvidenceRow[]; // the cited evidence rows (resolved)
  receipt: AnchorReceipt | null;
  corrections: Correction[]; // the correction trail targeting this finding
  verification_state: "verified" | "unverified" | "tampered";
  verification_message: string;
}

/** A human correction the surface can submit — contract.ts Correction shape. */
export interface CorrectionDraft {
  source_packet_id: string;
  correction_kind: CorrectionKind;
  reason: string;
}

// ───────────────────────────── SEAM (stable API) ─────────────────────────────

/**
 * List all finding provenance views. Builds the live chain from the engine packets
 * (+ persisted corrections) and re-verifies it in-browser. Each base finding shows
 * its ENGINE receipt, cross-checked against the browser-recomputed hash for parity.
 */
export async function listProvenance(): Promise<ProvenanceView[]> {
  const events = await buildChain(basePackets());
  const report = await verifyEvents(events);
  const linkOk = new Map(report.links.map((l) => [l.packet_id, l.ok]));
  const browserHashById = new Map(events.map((e) => [e.packet_id, e.packet_hash]));

  return ENGINE.findings.map(({ savings, packet, receipt, sourceRows }) => {
    const corrections = correctionsFor(packet.id);
    // The browser independently re-derived this packet's hash (WebCrypto); it must equal the
    // hash the Node engine anchored (byte-parity of the canonical scheme), and the row must link.
    const hashMatches = browserHashById.get(packet.id) === receipt.packet_hash;
    const linked = linkOk.get(packet.id) ?? false;
    const ok = hashMatches && linked;
    return {
      finding: packet,
      savings,
      sourceRows,
      receipt,
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

/** Load one finding's provenance view by packet/finding id. */
export async function loadProvenance(
  packetId: string,
): Promise<ProvenanceView | null> {
  const views = await listProvenance();
  return views.find((v) => v.finding.id === packetId) ?? null;
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
 * Returns a per-link report (engine findings + correction entries).
 */
export async function verifyChain(): Promise<{
  ok: boolean;
  links: { packet_id: string; ok: boolean }[];
}> {
  const events = await buildChain(basePackets());
  const report = await verifyEvents(events);
  return { ok: report.ok, links: report.links };
}
