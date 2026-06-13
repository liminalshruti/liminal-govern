/**
 * Canonical packet hashing — the substrate primitive.
 *
 * Prior art (re-implemented clean here, NOT copied):
 *   - `liminal-agents-v1/lib/substrate/packet-hash.ts` — the stableStringify → SHA-256-over-
 *     canonical-payload scheme, with anchor fields excluded by design.
 *   - the `liminal-desktop` event-log crate's canonical_json.
 *
 * Contract (what makes a hash trustworthy):
 *   - SHA-256 over a STABLY-serialized canonical payload.
 *   - Object keys sorted at every level → independent of author key-insertion order.
 *   - Reads sorted by `ordinal` → independent of fetch/storage order.
 *   - A schema string is part of the input, so a future schema bump cannot collide.
 *   - Anchor receipt fields are EXCLUDED — anchoring decorates a stable id, it does not
 *     redefine the artifact. (Packet/AgentRead carry no anchor fields, so this is structural.)
 */

import { createHash } from "node:crypto";
import type { AgentRead, Packet } from "./types.js";

/** Schema tag — bumping this is how hash versions are gated (no cross-version collisions). */
export const PACKET_HASH_SCHEMA = "liminal.provenance.v1";

/**
 * Stable JSON serialization with sorted object keys.
 *
 * `JSON.stringify` is unstable across key insertion order; this sorts keys at every level so
 * the same logical value always produces the same string. Arrays preserve order (intentional —
 * read order is normalized via `ordinal` sort in `canonicalPacketPayload`).
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

/**
 * The canonical payload for a packet — exactly what gets hashed.
 *
 * Fixed, enumerated field list (aligned to the `contract.ts` Packet/AgentRead shapes).
 * Optional fields resolve to explicit defaults so an absent field and an explicit-null field
 * hash identically. No anchor fields exist on these types, so none can leak into the hash.
 */
export function canonicalPacketPayload(input: { packet: Packet; reads: AgentRead[] }): unknown {
  const p = input.packet;
  return {
    schema: PACKET_HASH_SCHEMA,
    packet: {
      id: p.id,
      kind: p.kind ?? "regular",
      context: p.context,
      source_packet_id: p.source_packet_id ?? null,
      user_correction: p.user_correction ?? null,
      correction_kind: p.correction_kind ?? null,
      chosen_agent: p.chosen_agent ?? null,
      created_at: p.created_at,
    },
    reads: [...input.reads]
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((r) => ({
        agent_name: r.agent_name,
        archetype: r.archetype,
        quoted: r.quoted,
        situation: r.situation,
        hidden_risk: r.hidden_risk,
        next_move: r.next_move,
        refusal: r.refusal ?? null,
        refusal_kind: r.refusal_kind ?? null,
        ordinal: r.ordinal,
      })),
  };
}

/** SHA-256 hex over the UTF-8 bytes of a string. Lowercase hex. */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Compute the canonical SHA-256 hash (64-char lowercase hex) of a packet + its reads.
 *
 * Deterministic across object-literal key order, read sort order, and re-fetches from any
 * storage backend. NOT deterministic across schema changes — that is the version gate.
 */
export function computePacketHash(input: { packet: Packet; reads: AgentRead[] }): string {
  return sha256Hex(stableStringify(canonicalPacketPayload(input)));
}

/** The canonical string itself (useful for cross-impl byte-parity golden vectors). */
export function canonicalString(input: { packet: Packet; reads: AgentRead[] }): string {
  return stableStringify(canonicalPacketPayload(input));
}
