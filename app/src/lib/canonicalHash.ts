/**
 * Browser port of provenance/src/hash.ts — the canonical packet-hash scheme.
 *
 * The seam bakes its chain at build time with the real lib (node:crypto). But a
 * LIVE correction the operator signs in the browser also deserves a real hash,
 * linked to the chain tip. node:crypto isn't available in the browser, so this
 * mirrors the exact canonical scheme (stableStringify → SHA-256 over the
 * enumerated canonical payload, schema-tagged, anchor fields excluded) using Web
 * Crypto. Same bytes in → same SHA-256 out as provenance/src/hash.ts.
 */

import type { AgentRead, Packet } from "./contract";

export const PACKET_HASH_SCHEMA = "liminal.provenance.v1";

/** Stable JSON: object keys sorted at every level, arrays preserve order. */
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

/** The exact enumerated canonical payload — mirrors canonicalPacketPayload. */
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

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Real canonical SHA-256 of a packet + reads — byte-identical to the lib. */
export async function computePacketHash(input: {
  packet: Packet;
  reads: AgentRead[];
}): Promise<string> {
  return sha256Hex(stableStringify(canonicalPacketPayload(input)));
}
