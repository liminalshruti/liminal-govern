/**
 * Provenance data-seam (cockpit · Build Day 2026-06-13).
 *
 * Components import ONLY from this module; they never know where the data comes
 * from. The four exported functions (loadProvenance / listProvenance /
 * submitCorrection / verifyChain) keep stable signatures.
 *
 * ┌──────────────────────────── LIVE BROWSER PROVENANCE ────────────────────────────┐
 * │ Findings are derived from the seeded CSV fixtures (./fixtures.ts) and wrapped as │
 * │ contract `Packet`s. Those packets are fed into ./chain.ts — a BROWSER-NATIVE     │
 * │ provenance chain that mirrors `../../provenance/`'s canonical hash scheme        │
 * │ EXACTLY (stableStringify → SHA-256 over the anchor-excluded, schema-tagged,      │
 * │ ordinal-sorted canonical payload), but using WebCrypto instead of node:crypto    │
 * │ so it runs in the browser. The chain is in-memory + localStorage-persisted,      │
 * │ hash-linked, with local-first `anchorLocal` receipts.                            │
 * │                                                                                  │
 * │ Why a re-implementation and not `provenance/` directly: that library links       │
 * │ against better-sqlite3 (a native Node addon) and CANNOT run in a browser. The    │
 * │ hashes here are byte-identical to what `provenance/` would produce for the same  │
 * │ packet — verified by a golden-vector parity check (see app/README.md, Phase-3).  │
 * │                                                                                  │
 * │ Corrections are appended as NEW linked entries that re-anchor (never mutations), │
 * │ persisted across reloads, and the chain re-verifies live after each one.         │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * CONTRACT ALIGNMENT (src/lib/contract.ts, mirrored from coordination/contract.ts):
 *   - ProvenanceView.finding  ↔ Packet (kind === "finding")
 *   - ProvenanceView.receipt  ↔ AnchorReceipt
 *   - submitCorrection payload ↔ Correction
 */

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
  type ChainEvent,
} from "./chain";
import {
  deriveFindings,
  loadSeatActivity,
  loadSpend,
  reconcileUtilization,
  type UtilizationRow,
} from "./fixtures";

/** The unit the provenance surface renders: a finding, its receipt, its verify state. */
export interface ProvenanceView {
  finding: Packet; // kind === "finding"
  savings: SavingsFinding; // the structured spend finding behind the packet
  sourceRows: UtilizationRow[]; // the cited evidence rows (resolved)
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

const ANCHORED_AT = "2026-06-13T09:00:00.000Z";

/** Wrap a SavingsFinding as a contract `Packet` (kind: "finding"). */
function findingToPacket(f: SavingsFinding): Packet {
  return {
    id: f.finding_id,
    kind: "finding",
    context: `${f.vendor} utilization ${f.utilization_pct}% — ${f.recommended_action}`,
    reads: [
      {
        agent_name: "Auditor",
        archetype: "diligence",
        quoted: `${f.vendor} shows ${f.utilization_pct}% seat utilization over 30d.`,
        situation: `Reconciled from rows ${f.source_row_ids.join(", ")}.`,
        hidden_risk: "Seat sprawl: paying for inactive seats compounds monthly.",
        next_move: f.recommended_action,
        ordinal: 0,
      },
    ],
    created_at: ANCHORED_AT,
  };
}

/** Load all finding packets + cited source rows from the fixtures (deterministic order). */
async function loadFindings(): Promise<
  { savings: SavingsFinding; packet: Packet; rows: UtilizationRow[] }[]
> {
  const [spend, activity] = await Promise.all([loadSpend(), loadSeatActivity()]);
  const reconciled = reconcileUtilization(spend, activity);
  const byRow = new Map(reconciled.map((r) => [r.row_id, r]));
  const findings = deriveFindings(reconciled);
  return findings.map((savings) => ({
    savings,
    packet: findingToPacket(savings),
    rows: savings.source_row_ids
      .map((id) => byRow.get(id))
      .filter((r): r is UtilizationRow => Boolean(r)),
  }));
}

/** Build the live chain from fixture findings + persisted corrections. */
async function buildLiveChain(): Promise<{
  findings: { savings: SavingsFinding; packet: Packet; rows: UtilizationRow[] }[];
  events: ChainEvent[];
}> {
  const findings = await loadFindings();
  const events = await buildChain(findings.map((f) => f.packet));
  return { findings, events };
}

// ───────────────────────────── SEAM (stable API) ─────────────────────────────

/** List all finding provenance views, hash-linked into the live chain. */
export async function listProvenance(): Promise<ProvenanceView[]> {
  const { findings, events } = await buildLiveChain();
  const report = await verifyEvents(events);
  const linkOk = new Map(report.links.map((l) => [l.packet_id, l.ok]));
  const eventById = new Map(events.map((e) => [e.packet_id, e]));

  return findings.map(({ savings, packet, rows }) => {
    const event = eventById.get(packet.id) ?? null;
    const ok = linkOk.get(packet.id) ?? false;
    const corrections = correctionsFor(packet.id);
    return {
      finding: packet,
      savings,
      sourceRows: rows,
      receipt: event?.receipt ?? null,
      corrections,
      verification_state: ok ? "verified" : "tampered",
      verification_message: ok
        ? `Local-first — SHA-256 anchored and chain-linked${
            corrections.length ? ` · ${corrections.length} correction(s) re-anchored` : ""
          }.`
        : "Chain link broken — hash mismatch.",
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
 * browser-native chain (never mutates), persists it to localStorage, and
 * re-anchors on the next chain build. Returns the contract `Correction`.
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
 * Returns a per-link report (findings + correction entries).
 */
export async function verifyChain(): Promise<{
  ok: boolean;
  links: { packet_id: string; ok: boolean }[];
}> {
  const { events } = await buildLiveChain();
  const report = await verifyEvents(events);
  return { ok: report.ok, links: report.links };
}
