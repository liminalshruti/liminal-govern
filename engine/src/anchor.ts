/**
 * anchorFindings() — commit savings findings to the local-first provenance chain.
 *
 * Each SavingsFinding is wrapped as a `kind:"finding"` Packet whose `context` carries the cited
 * evidence (source row ids + recomputed utilization) and whose single AgentRead records the
 * auditor's reasoning. ingestPacket() appends it to a hash-linked ProvenanceLog and mints a local
 * AnchorReceipt. The chain is then verifiable end-to-end: verifyChain() === true, and any byte
 * tampered in a stored finding breaks its row hash.
 *
 * reconcileFindings() is the lib's reconcile() — the per-finding savings must sum to the headline
 * total within ±$1, or the report is not trustworthy.
 */

import {
  ProvenanceLog,
  ingestPacket,
  reconcile,
} from "./provenance.js";
import type {
  AgentRead,
  AnchorReceipt,
  Packet,
  ReconcileResult,
  SavingsFinding,
} from "./provenance.js";

export interface AnchorOptions {
  /** Reuse an existing log; otherwise one is created. */
  log?: ProvenanceLog;
  /** Where to persist the chain when no log is passed (defaults to in-memory). */
  dbPath?: string;
  /** Fixed timestamp for deterministic hashing in tests. */
  now?: string;
}

export interface AnchorResult {
  log: ProvenanceLog;
  receipts: AnchorReceipt[];
}

/** Turn a finding into a finding-Packet whose context carries its cited evidence. */
export function findingToPacket(finding: SavingsFinding, created_at: string): Packet {
  const read: AgentRead = {
    agent_name: "spend-auditor",
    archetype: "auditor",
    quoted: finding.recommended_action,
    situation: `${finding.vendor} at ${finding.utilization_pct}% 30-day seat utilization`,
    hidden_risk: "Idle seats renew silently; the waste compounds every month until rightsized.",
    next_move: finding.recommended_action,
    ordinal: 0,
  };
  return {
    id: finding.finding_id,
    kind: "finding",
    context: JSON.stringify({
      finding_id: finding.finding_id,
      source_row_ids: finding.source_row_ids,
      vendor: finding.vendor,
      utilization_pct: finding.utilization_pct,
      monthly_savings: finding.monthly_savings,
    }),
    reads: [read],
    created_at,
  };
}

/**
 * Anchor every finding into the chain, in order, returning the receipts. The returned `log` is
 * left open so callers can verifyChain()/inspect; close it when done.
 */
export async function anchorFindings(
  findings: SavingsFinding[],
  opts: AnchorOptions = {},
): Promise<AnchorResult> {
  const log = opts.log ?? new ProvenanceLog(opts.dbPath ?? ":memory:");
  const receipts: AnchorReceipt[] = [];

  for (let i = 0; i < findings.length; i++) {
    const finding = findings[i]!;
    // Deterministic, monotonically-increasing timestamps when a fixed `now` is supplied.
    const created_at = opts.now
      ? new Date(Date.parse(opts.now) + i * 1000).toISOString()
      : new Date().toISOString();
    const packet = findingToPacket(finding, created_at);
    const { receipt } = await ingestPacket(log, packet);
    receipts.push(receipt);
  }

  return { log, receipts };
}

/** Reconcile per-finding savings to the headline total (±tolerance, default $1). */
export function reconcileFindings(
  findings: Pick<SavingsFinding, "monthly_savings">[],
  total: number,
  tolerance = 1,
): ReconcileResult {
  return reconcile(findings, total, tolerance);
}
