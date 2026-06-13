/**
 * Correction flow + ingest + reconcile — the operations layer over the log.
 *
 * A correction is NEVER a mutation. `correct()` appends a NEW linked event whose packet carries
 * `source_packet_id` (→ the corrected packet) and re-anchors it. The original row is untouched,
 * immutable by the log's INSERT-only contract. "The correction loop IS the product" — made
 * literal: corrections are first-class entries in the same chain.
 */

import { anchorLocal, anchorOnchain } from "./anchor.js";
import { computePacketHash } from "./hash.js";
import type { ProvenanceLog } from "./log.js";
import type {
  AgentRead,
  AnchorReceipt,
  ChainEvent,
  Correction,
  CorrectionKind,
  Packet,
  SavingsFinding,
} from "./types.js";

export interface IngestResult {
  event: ChainEvent;
  receipt: AnchorReceipt;
}

/**
 * Append a packet to the log and anchor it (local-first; on-chain attempted only if
 * `ANCHOR_URL` is set, best-effort). Returns the row + the local receipt.
 */
export async function ingestPacket(log: ProvenanceLog, packet: Packet): Promise<IngestResult> {
  const reads = packet.reads ?? [];
  const event = log.append({
    id: packet.id,
    kind: "packet",
    packet_id: packet.id,
    packet,
    reads,
    created_at: packet.created_at,
  });

  const receipt = anchorLocal(event.packet_hash, event.prev_hash);
  receipt.packet_id = packet.id;
  log.saveReceipt(receipt);

  // Best-effort on-chain anchor (env-gated). Never blocks; receipt above already stands.
  const onchain = await anchorOnchain(event.packet_hash);
  if (onchain) {
    onchain.packet_id = packet.id;
    onchain.prev_hash = event.prev_hash;
    log.saveReceipt(onchain);
  }

  return { event, receipt };
}

export interface CorrectResult {
  correction: Correction;
  event: ChainEvent;
  receipt: AnchorReceipt;
}

/**
 * Correct an existing packet. Appends a NEW linked entry (a finding packet whose
 * `source_packet_id` points at the corrected one) and re-anchors. The source row is immutable.
 */
export async function correct(
  log: ProvenanceLog,
  source_packet_id: string,
  correction: { reason: string; correction_kind?: CorrectionKind; id?: string; reads?: AgentRead[] },
): Promise<CorrectResult> {
  const source = log.byId(source_packet_id);
  if (!source) {
    throw new Error(`correct: no entry with id "${source_packet_id}"`);
  }

  const created_at = new Date().toISOString();
  const correction_kind: CorrectionKind = correction.correction_kind ?? "outer";
  const correctionId = correction.id ?? `corr_${source_packet_id}_${Date.now()}`;

  const correctedPacket: Packet = {
    id: correctionId,
    kind: "finding",
    context: `correction of ${source_packet_id}`,
    reads: correction.reads ?? [],
    source_packet_id,
    user_correction: correction.reason,
    correction_kind,
    created_at,
  };

  const event = log.append({
    id: correctionId,
    kind: "correction",
    packet_id: correctionId,
    packet: correctedPacket,
    reads: correctedPacket.reads,
    created_at,
  });

  const receipt = anchorLocal(event.packet_hash, event.prev_hash);
  receipt.packet_id = correctionId;
  log.saveReceipt(receipt);

  const onchain = await anchorOnchain(event.packet_hash);
  if (onchain) {
    onchain.packet_id = correctionId;
    onchain.prev_hash = event.prev_hash;
    log.saveReceipt(onchain);
  }

  const correctionRecord: Correction = {
    id: correctionId,
    source_packet_id,
    correction_kind,
    reason: correction.reason,
    created_at,
  };

  return { correction: correctionRecord, event, receipt };
}

/** Re-compute a packet's canonical hash (helper for callers that want to verify out-of-band). */
export function hashOf(packet: Packet): string {
  return computePacketHash({ packet, reads: packet.reads ?? [] });
}

// ─────────────────────── Reconciliation hook (spend use case) ───────────────────────

export interface ReconcileResult {
  ok: boolean;
  sum: number;
  total: number;
  delta: number;
  tolerance: number;
}

/**
 * Assert that the sum of `monthly_savings` across findings reconciles to a reported `total`
 * within ±tolerance (default $1). Used by the spend audit: every finding cites raw rows, and
 * the per-line savings must add up to the headline number — evidence, not assertion.
 */
export function reconcile(
  findings: Pick<SavingsFinding, "monthly_savings">[],
  total: number,
  tolerance = 1,
): ReconcileResult {
  const sum = findings.reduce((acc, f) => acc + f.monthly_savings, 0);
  const delta = Math.abs(sum - total);
  return { ok: delta <= tolerance, sum, total, delta, tolerance };
}
