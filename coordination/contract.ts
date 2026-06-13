// contract.ts — THE SINGLE SHARED WIRE-TYPE FILE.
//
// Every stream imports its cross-surface types from here. If you need to add or change a type,
// COORDINATE FIRST (announce in INTEGRATION_HANDOFF) — this file is the contract that lets the
// streams converge without stepping on each other (Berlin's `contract.ts` discipline).
//
// Seeded from S1 (provenance chain). Move this file into the public submission repo once named;
// until then it is the canonical reference the code repos mirror.

// ───────────────────────── Provenance chain (S1) ─────────────────────────

export type PacketKind = "regular" | "finding";

export type CorrectionKind = "inner" | "outer" | "cross" | "emergence";

/** One bounded-agent read of a context. */
export interface AgentRead {
  agent_name: string;
  archetype: string;          // register / lane the agent occupies
  quoted: string;             // what the agent saw, in its words
  situation: string;
  hidden_risk: string;
  next_move: string;
  refusal?: string;           // present iff the agent refused out-of-lane
  refusal_kind?: string;
  ordinal: number;            // stable order within a packet
}

/** A unit of work emitted by the agents and recorded in the chain. */
export interface Packet {
  id: string;
  kind: PacketKind;           // "finding" for audit results that cite a source
  context: string;            // the input the agents read
  reads: AgentRead[];
  source_packet_id?: string;  // set when this packet derives from / corrects another
  user_correction?: string;
  correction_kind?: CorrectionKind;
  chosen_agent?: string | null;
  created_at: string;         // ISO-8601
}

/** Proof that a packet's hash was anchored (local-first by default). */
export interface AnchorReceipt {
  packet_id: string;
  packet_hash: string;        // SHA-256 hex over the canonical payload (excludes anchor fields)
  prev_hash: string | null;   // hash-link to the previous entry → the chain
  anchored_at: string;        // ISO-8601
  anchor_chain: "local" | "algorand";
  anchor_network: string;     // e.g. "local-first" | "testnet"
  anchor_txn_id?: string;     // present only for on-chain anchors
}

/** A human correction — itself a new linked entry, never a mutation. */
export interface Correction {
  id: string;
  source_packet_id: string;
  correction_kind: CorrectionKind;
  reason: string;
  created_at: string;
}

// ─────────────────────── Spend use case (S4 — fixture) ───────────────────────
// Operator-framed software/AI-spend audit. Findings reference these source rows by id so the
// provenance chain can cite them. (NOT a dashboard — decision artifacts with citations.)

export interface SpendLineItem {
  row_id: string;
  vendor: string;
  plan: string;
  seats_purchased: number;
  monthly_cost: number;       // USD
}

export interface SeatActivity {
  row_id: string;             // joins to SpendLineItem.row_id
  vendor: string;
  active_seats_30d: number;
}

export interface SavingsFinding {
  finding_id: string;
  source_row_ids: string[];   // the cited evidence rows
  vendor: string;
  utilization_pct: number;    // recomputed from raw activity, not assumed
  recommended_action: string;
  monthly_savings: number;    // USD; sum of these reconciles to the report total ±$1
}

// ─────────────────────── Plugin / desktop seam (S2 / S3) ───────────────────────

export interface OnboardingStream {
  source: string;             // e.g. "granola" | "git" | "claude-code" | "calendar"
  agent_owner: string;        // which bounded agent ingests this stream (swarm onboarding)
  status: "pending" | "scanning" | "ingested";
}
