/**
 * Provenance data-seam (cockpit · Build Day 2026-06-13).
 *
 * Components import ONLY from this module; they never touch report.json directly.
 * The exported functions (listProvenance / loadProvenance / submitCorrection /
 * listCorrections / verifyChain) keep stable signatures.
 *
 * ┌──────────────── SINGLE SOURCE OF TRUTH: out/report.json (baked at build time) ────────────────┐
 * │ The cockpit reads the SAME artifact the S4 deliberation workflow + the pitch use:             │
 * │ the engine's `out/report.json` (baked to src/generated/report.json by scripts/prebuild.mjs).  │
 * │                                                                                               │
 * │ Each LIVE finding becomes a provenance Packet; the kept findings (E14's refuted claim         │
 * │ excluded) plus the ratified governance decision are hash-linked into an append-only chain     │
 * │ via ./chain.ts (WebCrypto SHA-256, mirroring the Node provenance/ scheme byte-for-byte). The  │
 * │ browser re-verifies the whole chain live. Human corrections append as NEW linked entries on   │
 * │ top of the anchored chain (never mutations), persist across reloads, and re-verify live.      │
 * │                                                                                               │
 * │ The dropped claim (F-E14, $162) is NOT on the chain — it was refuted by adversarial review    │
 * │ (PR-103) and dropped. That IS the governance beat: agents disagreed, the operator's           │
 * │ correction is what got anchored. listDropped() surfaces it for the Findings screen.           │
 * └───────────────────────────────────────────────────────────────────────────────────────────┘
 */

import {
  REPORT,
  evidenceFor,
  headline,
  liveFindings,
  droppedFindings,
  type ClassifiedUsage,
  type ReportFinding,
} from "./report";
import type { AnchorReceipt, Correction, CorrectionKind, Packet } from "./contract";
import {
  appendCorrection,
  buildChain,
  correctionsFor,
  listPersistedCorrections,
  verifyChain as verifyEvents,
} from "./chain";

const ANCHORED_AT = "2026-06-13T09:00:00.000Z";

/** Stable per-entry timestamp so packets/hashes are byte-identical across reloads. */
function stampAt(i: number): string {
  return new Date(Date.parse(ANCHORED_AT) + i * 1000).toISOString();
}

/** A report finding → the exact Packet the chain hashes. */
function findingToPacket(f: ReportFinding, created_at: string): Packet {
  return {
    id: f.finding_id,
    kind: "finding",
    context: `${f.type} · ${f.recommended_action}`,
    reads: [],
    chosen_agent: f.approved_alternative_id ?? null,
    created_at,
  };
}

/** The ratified governance decision → the final anchored packet (the cap). */
function ratifyPacket(created_at: string): Packet {
  return {
    id: "D-RATIFY-CAL",
    kind: "finding",
    context: `ratified_decision · ${REPORT.ratified_decision.decision}`,
    reads: [],
    created_at,
  };
}

/**
 * The deterministic anchored chain, in order: the LIVE findings (refuted claims
 * excluded) followed by the ratified decision — 6 entries, mirroring
 * report.json#provenance.anchored.
 */
function basePackets(): Packet[] {
  const live = liveFindings();
  const packets = live.map((f, i) => findingToPacket(f, stampAt(i)));
  packets.push(ratifyPacket(stampAt(live.length)));
  return packets;
}

const findingById = new Map(REPORT.findings.map((f) => [f.finding_id, f]));

/** Headline figures the pitch quotes (re-exported from report.ts). */
export const reportSummary = headline;

/** The unit the provenance surface renders: a finding, its evidence, its anchor + verify. */
export interface ProvenanceView {
  finding: Packet;
  reportFinding: ReportFinding;
  evidence: ClassifiedUsage[];
  receipt: AnchorReceipt | null;
  corrections: Correction[];
  verification_state: "verified" | "tampered";
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
 * List the live-finding provenance views. Builds the chain from the report's anchored
 * packets (+ persisted corrections) and re-verifies it in-browser. The ratified-decision
 * packet anchors the chain but is not itself a "finding" view.
 */
export async function listProvenance(): Promise<ProvenanceView[]> {
  const events = await buildChain(basePackets());
  const report = await verifyEvents(events);
  const linkOk = new Map(report.links.map((l) => [l.packet_id, l.ok]));
  const byId = new Map(events.map((e) => [e.packet_id, e]));

  return liveFindings().map((reportFinding) => {
    const event = byId.get(reportFinding.finding_id)!;
    const corrections = correctionsFor(reportFinding.finding_id);
    const ok = linkOk.get(reportFinding.finding_id) ?? false;
    return {
      finding: event.packet,
      reportFinding,
      evidence: evidenceFor(reportFinding.source_row_ids),
      receipt: event.receipt,
      corrections,
      verification_state: ok ? "verified" : "tampered",
      verification_message: ok
        ? `Anchored SHA-256, re-verified in-browser${
            corrections.length ? ` · ${corrections.length} correction(s) re-anchored` : ""
          }.`
        : "Chain link/hash mismatch — receipt did not re-verify in-browser.",
    };
  });
}

/** Load one finding's provenance view by finding id. */
export async function loadProvenance(packetId: string): Promise<ProvenanceView | null> {
  const views = await listProvenance();
  return views.find((v) => v.finding.id === packetId) ?? null;
}

/** The refuted/dropped claims (E14 → $162), with their drop reason + evidence. */
export function listDropped(): { finding: ReportFinding; evidence: ClassifiedUsage[] }[] {
  return droppedFindings().map((finding) => ({
    finding,
    evidence: evidenceFor(finding.source_row_ids),
  }));
}

/** Look up the raw report finding by id (for the decision log / cross-screen use). */
export function getReportFinding(id: string): ReportFinding | undefined {
  return findingById.get(id);
}

/**
 * Submit a correction against a finding — appends a NEW linked entry to the
 * browser-native chain on top of the anchored findings (never mutates), persists
 * it, and re-anchors on the next chain build.
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
 */
export async function verifyChain(): Promise<{
  ok: boolean;
  links: { packet_id: string; ok: boolean }[];
}> {
  const events = await buildChain(basePackets());
  const report = await verifyEvents(events);
  return { ok: report.ok, links: report.links };
}
