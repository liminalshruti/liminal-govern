/**
 * chain.ts — BROWSER-NATIVE provenance chain (cockpit · Build Day 2026-06-13).
 *
 * The canonical provenance library at `../../provenance/` is Node-only: it links
 * against `better-sqlite3`, which cannot run in a browser. This module is a
 * browser-native re-implementation that mirrors that library's hash scheme
 * EXACTLY, so a packet hashed here produces the SAME 64-char hex as
 * `provenance/`'s `computePacketHash` would for the same packet.
 *
 * Mirrored from `provenance/src/hash.ts` (verified byte-parity):
 *   - `stableStringify`         — sorted object keys at every level, arrays in order.
 *   - `canonicalPacketPayload`  — schema-tagged, anchor-excluded, ordinal-sorted reads.
 *   - SHA-256 over that canonical string → lowercase hex.
 *
 * The ONLY substantive difference from the canonical lib is the digest primitive:
 *   - canonical: `node:crypto` `createHash("sha256")` (synchronous, Node-only)
 *   - browser:   WebCrypto `crypto.subtle.digest("SHA-256", …)` (async, universal)
 * Both produce identical bytes (proven by a golden-vector parity check at build time).
 *
 * Storage mirrors `provenance/src/log.ts`'s append-only, hash-linked event log, but
 * over an in-memory array persisted to `localStorage` instead of SQLite. Corrections
 * are appended as NEW linked entries that re-anchor — never mutations (mirrors
 * `provenance/src/correct.ts`).
 */

import type {
  AgentRead,
  AnchorReceipt,
  Correction,
  CorrectionKind,
  Packet,
} from "./contract";

// ───────────────────────── Canonical hash (mirrors provenance/src/hash.ts) ─────────────────────────

/** Schema tag — identical to the canonical lib. Bumping this gates hash versions. */
export const PACKET_HASH_SCHEMA = "liminal.provenance.v1";

/**
 * Stable JSON serialization with sorted object keys. Byte-identical to the
 * canonical lib's `stableStringify`: object keys sorted at every level, arrays
 * preserved in order (read order is normalized via `ordinal` in the payload).
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
 * The canonical payload for a packet — exactly what gets hashed. Field-for-field
 * identical to `provenance/src/hash.ts#canonicalPacketPayload`: fixed enumerated
 * fields, optional fields resolved to explicit `null`, reads sorted by `ordinal`,
 * schema tag included, NO anchor fields (anchoring decorates a stable id).
 */
export function canonicalPacketPayload(input: {
  packet: Packet;
  reads: AgentRead[];
}): unknown {
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

/** The canonical string itself (the cross-impl byte-parity golden vector). */
export function canonicalString(input: { packet: Packet; reads: AgentRead[] }): string {
  return stableStringify(canonicalPacketPayload(input));
}

/**
 * SHA-256 hex over the UTF-8 bytes of a string, via WebCrypto. Lowercase hex.
 * Produces the SAME bytes as the canonical lib's `node:crypto` `sha256Hex`.
 */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Compute the canonical SHA-256 hash (64-char lowercase hex) of a packet + reads.
 * Matches `provenance/src/hash.ts#computePacketHash` exactly.
 */
export async function computePacketHash(input: {
  packet: Packet;
  reads: AgentRead[];
}): Promise<string> {
  return sha256Hex(canonicalString(input));
}

// ───────────────────────── Anchoring (mirrors provenance/src/anchor.ts) ─────────────────────────

/** Bytes in a valid proof (SHA-256 digest length). */
const PROOF_BYTE_LEN = 32;

/** Validate a packet hash has the 32-byte, non-zero proof shape. Throws on bad shape. */
export function assertValidProof(packet_hash: string): void {
  if (!/^[0-9a-f]+$/.test(packet_hash)) {
    throw new Error(`anchor: non-hex characters in proof "${packet_hash}"`);
  }
  if (packet_hash.length !== PROOF_BYTE_LEN * 2) {
    throw new Error(
      `anchor: expected ${PROOF_BYTE_LEN}-byte proof (${PROOF_BYTE_LEN * 2} hex chars), got ${packet_hash.length}`,
    );
  }
  if (/^0+$/.test(packet_hash)) {
    throw new Error("anchor: refusing to anchor an all-zero proof");
  }
}

/**
 * Mint a local-first anchor receipt, hash-linked to `prev_hash`. No network.
 * Mirrors `provenance/src/anchor.ts#anchorLocal` (the on-chain path is env-gated
 * server-side and intentionally absent in the browser — local-first is the default).
 */
export function anchorLocal(
  packet_id: string,
  packet_hash: string,
  prev_hash: string | null,
  anchored_at: string,
): AnchorReceipt {
  assertValidProof(packet_hash);
  return {
    packet_id,
    packet_hash,
    prev_hash,
    anchored_at,
    anchor_chain: "local",
    anchor_network: "local-first",
  };
}

// ───────────────────────── Append-only log (mirrors provenance/src/log.ts) ─────────────────────────

export type EventKind = "packet" | "correction";

/** One row in the append-only, hash-linked chain. */
export interface ChainEvent {
  id: string;
  kind: EventKind;
  packet_id: string;
  packet: Packet; // kept structured so the row can be re-hashed on verify
  reads: AgentRead[];
  payload_json: string; // stableStringify({ packet, reads }) — what verify re-hashes
  packet_hash: string;
  prev_hash: string | null;
  receipt: AnchorReceipt;
  created_at: string;
}

const ANCHORED_AT = "2026-06-13T09:00:00.000Z";
const LS_KEY = "liminal.provenance.corrections.v1";

/** The minimal persisted form of a correction (the user-authored chain delta). */
interface PersistedCorrection {
  id: string;
  source_packet_id: string;
  correction_kind: CorrectionKind;
  reason: string;
  created_at: string;
}

function readPersisted(): PersistedCorrection[] {
  try {
    const raw = globalThis.localStorage?.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as PersistedCorrection[]) : [];
  } catch {
    return [];
  }
}

function writePersisted(list: PersistedCorrection[]): void {
  try {
    globalThis.localStorage?.setItem(LS_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable (SSR / private mode) — corrections stay in-session */
  }
}

// In-memory mirror of the persisted corrections (kept in sync so reads are synchronous).
let correctionCache: PersistedCorrection[] = readPersisted();

/**
 * Build the corrected-packet for a persisted correction — mirrors
 * `provenance/src/correct.ts`: kind "finding", carries `source_packet_id`,
 * `user_correction`, `correction_kind`. The reads default to [] (the human
 * correction is the authored content; agent re-reads land in Phase-3).
 */
function correctionToPacket(c: PersistedCorrection): Packet {
  return {
    id: c.id,
    kind: "finding",
    context: `correction of ${c.source_packet_id}`,
    reads: [],
    source_packet_id: c.source_packet_id,
    user_correction: c.reason,
    correction_kind: c.correction_kind,
    created_at: c.created_at,
  };
}

/** A persisted correction projected onto the contract `Correction` shape. */
function toCorrection(c: PersistedCorrection): Correction {
  return {
    id: c.id,
    source_packet_id: c.source_packet_id,
    correction_kind: c.correction_kind,
    reason: c.reason,
    created_at: c.created_at,
  };
}

/**
 * Build the full hash-linked chain: the deterministic `basePackets` (findings,
 * in derive order) followed by persisted corrections (in creation order). Each
 * entry's `prev_hash` links to the previous entry's `packet_hash`, and each is
 * re-anchored with a local-first receipt — exactly the canonical append flow.
 */
export async function buildChain(basePackets: Packet[]): Promise<ChainEvent[]> {
  const entries: { packet: Packet; kind: EventKind; anchored_at: string }[] = [
    ...basePackets.map((packet) => ({ packet, kind: "packet" as EventKind, anchored_at: ANCHORED_AT })),
    ...correctionCache.map((c) => ({
      packet: correctionToPacket(c),
      kind: "correction" as EventKind,
      anchored_at: c.created_at,
    })),
  ];

  const events: ChainEvent[] = [];
  let prev_hash: string | null = null;
  for (const e of entries) {
    const reads = e.packet.reads ?? [];
    const payload_json = stableStringify({ packet: e.packet, reads });
    const packet_hash = await computePacketHash({ packet: e.packet, reads });
    const receipt = anchorLocal(e.packet.id, packet_hash, prev_hash, e.anchored_at);
    events.push({
      id: e.packet.id,
      kind: e.kind,
      packet_id: e.packet.id,
      packet: e.packet,
      reads,
      payload_json,
      packet_hash,
      prev_hash,
      receipt,
      created_at: e.packet.created_at,
    });
    prev_hash = packet_hash;
  }
  return events;
}

export interface VerifyResult {
  ok: boolean;
  /** 0-based index of the first broken row, or -1 if intact. */
  brokenIndex: number;
  reason?: string;
  length: number;
  links: { packet_id: string; ok: boolean }[];
}

/**
 * Walk the chain — mirrors `provenance/src/log.ts#verifyChain`. Two checks per row:
 *   1. Self-consistency: re-hash the stored `payload_json`; it must equal the row's
 *      recorded `packet_hash` (catches a flipped byte in any payload).
 *   2. Link: the row's `prev_hash` must equal the previous row's `packet_hash`.
 */
export async function verifyChain(events: ChainEvent[]): Promise<VerifyResult> {
  let prev: string | null = null;
  let ok = true;
  let brokenIndex = -1;
  let reason: string | undefined;
  const links: { packet_id: string; ok: boolean }[] = [];

  for (let i = 0; i < events.length; i++) {
    const row = events[i]!;
    const parsed = JSON.parse(row.payload_json) as { packet: Packet; reads: AgentRead[] };
    const recomputed = await computePacketHash({ packet: parsed.packet, reads: parsed.reads });
    const selfOk = recomputed === row.packet_hash;
    const linkOk = row.prev_hash === prev;
    const rowOk = selfOk && linkOk;
    links.push({ packet_id: row.packet_id, ok: rowOk });
    if (!rowOk && ok) {
      ok = false;
      brokenIndex = i;
      reason = !selfOk
        ? `row ${i} (${row.id}): payload hash ${recomputed} != stored ${row.packet_hash}`
        : `row ${i} (${row.id}): prev_hash ${row.prev_hash} != expected ${prev}`;
    }
    prev = row.packet_hash;
  }
  return { ok, brokenIndex, reason, length: events.length, links };
}

/**
 * Append a human correction as a NEW linked chain entry (never a mutation) and
 * persist it. Mirrors `provenance/src/correct.ts#correct`: the entry re-anchors
 * when the chain is next built. Returns the contract `Correction` record.
 */
export function appendCorrection(draft: {
  source_packet_id: string;
  correction_kind: CorrectionKind;
  reason: string;
}): Correction {
  const created_at = new Date().toISOString();
  const id = `corr_${draft.source_packet_id}_${Date.now()}`;
  const persisted: PersistedCorrection = {
    id,
    source_packet_id: draft.source_packet_id,
    correction_kind: draft.correction_kind,
    reason: draft.reason,
    created_at,
  };
  correctionCache = [...correctionCache, persisted];
  writePersisted(correctionCache);
  return toCorrection(persisted);
}

/** All persisted corrections as contract `Correction` records (creation order). */
export function listPersistedCorrections(): Correction[] {
  return correctionCache.map(toCorrection);
}

/** Corrections that target a given source packet id. */
export function correctionsFor(source_packet_id: string): Correction[] {
  return correctionCache
    .filter((c) => c.source_packet_id === source_packet_id)
    .map(toCorrection);
}

/** Test/utility hook: clear the persisted correction chain. */
export function resetCorrections(): void {
  correctionCache = [];
  writePersisted(correctionCache);
}
