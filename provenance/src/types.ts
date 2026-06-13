/**
 * Wire types for the provenance chain.
 *
 * The cross-surface wire types below (PacketKind/CorrectionKind/AgentRead/Packet/AnchorReceipt/
 * Correction + the spend-use-case rows) MIRROR the canonical contract at
 * `../../coordination/contract.ts` field-for-field. That contract is the single source of truth;
 * this file is verified byte-identical to it (sans comments) by the `types-match-contract` test.
 *
 * Why mirrored, not imported: this library is a SELF-CONTAINED, extractable package. A
 * cross-package `../../coordination` source import would pull a file outside this package's
 * `rootDir` (TS6059) and drag the `coordination/` directory along with any extraction, defeating
 * the "self-contained provenance/ package" goal. So the shapes are mirrored here and a test
 * enforces zero drift toward the contract.
 *
 * Downstream streams (S2 plugin, S3 desktop UI, S4 anchor CLI) import the same shapes from the
 * same contract. The INTERNAL log shapes (`EventKind`, `ChainEvent`, `AppendInput`) are
 * implementation detail of this library and intentionally NOT part of the shared contract.
 *
 * Anchor receipt fields are deliberately separate from `Packet`/`AgentRead`: anchoring is a
 * decoration on a stable identifier, never part of the artifact's hashed identity.
 */

export type PacketKind = "regular" | "finding";

export type CorrectionKind = "inner" | "outer" | "cross" | "emergence";

/** One bounded-agent read of a context. */
export interface AgentRead {
  agent_name: string;
  archetype: string; // register / lane the agent occupies
  quoted: string; // what the agent saw, in its words
  situation: string;
  hidden_risk: string;
  next_move: string;
  refusal?: string; // present iff the agent refused out-of-lane
  refusal_kind?: string;
  ordinal: number; // stable order within a packet
}

/** A unit of work emitted by the agents and recorded in the chain. */
export interface Packet {
  id: string;
  kind: PacketKind; // "finding" for audit results that cite a source
  context: string; // the input the agents read
  reads: AgentRead[];
  source_packet_id?: string; // set when this packet derives from / corrects another
  user_correction?: string;
  correction_kind?: CorrectionKind;
  chosen_agent?: string | null;
  created_at: string; // ISO-8601
}

/** Proof that a packet's hash was anchored (local-first by default). */
export interface AnchorReceipt {
  packet_id: string;
  packet_hash: string; // SHA-256 hex over the canonical payload (excludes anchor fields)
  prev_hash: string | null; // hash-link to the previous entry → the chain
  anchored_at: string; // ISO-8601
  anchor_chain: "local" | "algorand";
  anchor_network: string; // e.g. "local-first" | "testnet"
  anchor_txn_id?: string; // present only for on-chain anchors
}

/** A human correction — itself a new linked entry, never a mutation. */
export interface Correction {
  id: string;
  source_packet_id: string;
  correction_kind: CorrectionKind;
  reason: string;
  created_at: string;
}

// ─────────────────────── Spend use case (reconcile hook) ───────────────────────

export interface SpendLineItem {
  row_id: string;
  vendor: string;
  plan: string;
  seats_purchased: number;
  monthly_cost: number; // USD
}

export interface SeatActivity {
  row_id: string; // joins to SpendLineItem.row_id
  vendor: string;
  active_seats_30d: number;
}

export interface SavingsFinding {
  finding_id: string;
  source_row_ids: string[]; // the cited evidence rows
  vendor: string;
  utilization_pct: number; // recomputed from raw activity, not assumed
  recommended_action: string;
  monthly_savings: number; // USD; sum of these reconciles to the report total ±$1
}

// ─────────────────────── Internal log shapes ───────────────────────

export type EventKind = "packet" | "correction";

/** A single row in the append-only log. */
export interface ChainEvent {
  id: string; // event id (== packet id for packet events)
  kind: EventKind;
  packet_id: string;
  payload_json: string; // canonical, what was hashed-around
  packet_hash: string;
  prev_hash: string | null;
  created_at: string;
}

/** Input to `append` — the hash + payload are computed/validated by the log layer. */
export interface AppendInput {
  id: string;
  kind: EventKind;
  packet_id: string;
  packet: Packet;
  reads: AgentRead[];
  created_at?: string;
}
