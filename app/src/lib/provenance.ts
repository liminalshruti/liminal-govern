/**
 * Provenance data-seam (cockpit · Build Day 2026-06-13).
 *
 * Adapted from liminal-desktop/src/lib/provenance.ts (S3) — same seam shape,
 * but the Tauri IPC backend is replaced by a WEB/FIXTURE backend so this
 * deploys to Vercel (lane G). Components import ONLY from this module; they
 * never know where the data comes from.
 *
 * ┌─────────────────────────── PHASE-3 SWAP POINT ───────────────────────────┐
 * │ Today: findings are derived from the seeded CSV fixtures (./fixtures.ts), │
 * │ wrapped as contract `Packet`s, and given deterministic local-first        │
 * │ `AnchorReceipt`s by mockAnchor().                                          │
 * │                                                                            │
 * │ Phase-3: the real provenance/ lib lands on build-day/s1-provenance. To     │
 * │ wire it in, replace the FIXTURE BACKEND section below (loadFindingPackets, │
 * │ mockAnchor, submitCorrection, verifyChain) with calls into provenance/ —   │
 * │ it already returns Packet / AnchorReceipt / Correction (contract.ts). The  │
 * │ four exported functions keep their signatures; NO component changes.       │
 * └────────────────────────────────────────────────────────────────────────┘
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
  verification_state: "verified" | "unverified" | "tampered";
  verification_message: string;
}

/** A human correction the surface can submit — contract.ts Correction shape. */
export interface CorrectionDraft {
  source_packet_id: string;
  correction_kind: CorrectionKind;
  reason: string;
}

// ───────────────────────── FIXTURE BACKEND (Phase-3 swap) ─────────────────────────

const ANCHORED_AT = "2026-06-13T09:00:00.000Z";

/** Tiny synchronous string hash → hex, stable per input. Stand-in for SHA-256. */
function pseudoHash(input: string): string {
  let h1 = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h1 ^= input.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  const hex = (h1 >>> 0).toString(16).padStart(8, "0");
  // Pad to a 64-char SHA-256-shaped hex string so the UI reads realistically.
  return (hex.repeat(8)).slice(0, 64);
}

/** Build a deterministic local-first anchor receipt, hash-linked to prev. */
function mockAnchor(packet: Packet, prevHash: string | null): AnchorReceipt {
  const payload = `${packet.id}|${packet.context}|${packet.created_at}`;
  return {
    packet_id: packet.id,
    packet_hash: pseudoHash(payload),
    prev_hash: prevHash,
    anchored_at: ANCHORED_AT,
    anchor_chain: "local",
    anchor_network: "local-first",
    // anchor_txn_id omitted: local-first, not yet on-chain. Phase-3 / Algorand sets it.
  };
}

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

/** Load all finding packets + cited source rows from the fixtures. */
async function loadFindingPackets(): Promise<
  { view: SavingsFinding; rows: UtilizationRow[] }[]
> {
  const [spend, activity] = await Promise.all([loadSpend(), loadSeatActivity()]);
  const reconciled = reconcileUtilization(spend, activity);
  const byRow = new Map(reconciled.map((r) => [r.row_id, r]));
  const findings = deriveFindings(reconciled);
  return findings.map((view) => ({
    view,
    rows: view.source_row_ids
      .map((id) => byRow.get(id))
      .filter((r): r is UtilizationRow => Boolean(r)),
  }));
}

// In-memory correction log. Phase-3: provenance/ appends a real linked entry.
const correctionLog: Correction[] = [];

// ───────────────────────────── SEAM (stable API) ─────────────────────────────

/** List all finding provenance views, hash-linked into a chain. */
export async function listProvenance(): Promise<ProvenanceView[]> {
  const findings = await loadFindingPackets();
  let prevHash: string | null = null;
  const views: ProvenanceView[] = [];
  for (const { view, rows } of findings) {
    const packet = findingToPacket(view);
    const receipt = mockAnchor(packet, prevHash);
    prevHash = receipt.packet_hash;
    views.push({
      finding: packet,
      savings: view,
      sourceRows: rows,
      receipt,
      verification_state: "verified",
      verification_message: "Local-first — hash present and chain-linked.",
    });
  }
  return views;
}

/** Load one finding's provenance view by packet/finding id. */
export async function loadProvenance(
  packetId: string,
): Promise<ProvenanceView | null> {
  const views = await listProvenance();
  return views.find((v) => v.finding.id === packetId) ?? null;
}

/**
 * Submit a correction against a finding — appends a new linked entry, never
 * mutates (contract.ts Correction discipline).
 *
 * PHASE-3 SEAM: today this pushes to an in-memory log and echoes the entry.
 * The real path is provenance/ append-correction (or S1's API), which returns
 * the same Correction. Wire it here WITHOUT touching the Correct button.
 */
export async function submitCorrection(
  draft: CorrectionDraft,
): Promise<{ ok: boolean; correction: Correction }> {
  const correction: Correction = {
    id: `C-${Date.now()}`,
    source_packet_id: draft.source_packet_id,
    correction_kind: draft.correction_kind,
    reason: draft.reason,
    created_at: new Date().toISOString(),
  };
  correctionLog.push(correction);
  // eslint-disable-next-line no-console
  console.info("[provenance seam] submitCorrection (fixture) — Phase-3 wires provenance/", correction);
  return { ok: true, correction };
}

/** Corrections appended this session (drives the decision log). */
export function listCorrections(): Correction[] {
  return [...correctionLog];
}

/**
 * Verify the finding chain links cleanly (each receipt.prev_hash matches the
 * previous receipt.packet_hash). Phase-3: provenance/ verifies real signatures
 * + on-chain anchors. Returns a per-link report.
 */
export async function verifyChain(): Promise<{
  ok: boolean;
  links: { packet_id: string; ok: boolean }[];
}> {
  const views = await listProvenance();
  let prevHash: string | null = null;
  let ok = true;
  const links = views.map((v) => {
    const linkOk = v.receipt?.prev_hash === prevHash;
    prevHash = v.receipt?.packet_hash ?? null;
    if (!linkOk) ok = false;
    return { packet_id: v.finding.id, ok: linkOk };
  });
  return { ok, links };
}
