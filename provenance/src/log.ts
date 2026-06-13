/**
 * Append-only, hash-linked event log over SQLite (better-sqlite3).
 *
 * Prior art (concept, re-implemented clean): the `liminal-desktop` event-log crate.
 *
 * Invariants:
 *   - One table, `events`. Rows are only ever INSERTed — never UPDATEd or DELETEd.
 *   - Each row carries `packet_hash` (canonical hash of its payload) and `prev_hash`
 *     (the previous row's `packet_hash`), forming a hash-linked chain.
 *   - `verifyChain()` walks the rows in insertion order and asserts every `prev_hash`
 *     equals the prior row's `packet_hash`, AND that each row's recorded `packet_hash`
 *     still matches a fresh hash of its stored `payload_json`. Tampering with any
 *     `payload_json` byte breaks the row's own hash → verification fails at that index.
 */

import Database from "better-sqlite3";
import { computePacketHash, stableStringify } from "./hash.js";
import type { AgentRead, AnchorReceipt, AppendInput, ChainEvent, Packet } from "./types.js";

export interface VerifyResult {
  ok: boolean;
  /** 0-based index of the first row that failed, or -1 if the chain is intact. */
  brokenIndex: number;
  reason?: string;
  length: number;
}

export class ProvenanceLog {
  private readonly db: Database.Database;

  constructor(path = ":memory:") {
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        seq          INTEGER PRIMARY KEY AUTOINCREMENT,
        id           TEXT NOT NULL,
        kind         TEXT NOT NULL,
        packet_id    TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        packet_hash  TEXT NOT NULL,
        prev_hash    TEXT,
        created_at   TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS receipts (
        seq            INTEGER PRIMARY KEY AUTOINCREMENT,
        packet_id      TEXT NOT NULL,
        packet_hash    TEXT NOT NULL,
        prev_hash      TEXT,
        anchored_at    TEXT NOT NULL,
        anchor_chain   TEXT NOT NULL,
        anchor_network TEXT NOT NULL,
        anchor_txn_id  TEXT
      );
    `);
  }

  /** Persist an anchor receipt (append-only; an entry can be re-anchored on correction). */
  saveReceipt(receipt: AnchorReceipt): void {
    this.db
      .prepare(
        `INSERT INTO receipts (packet_id, packet_hash, prev_hash, anchored_at, anchor_chain, anchor_network, anchor_txn_id)
         VALUES (@packet_id, @packet_hash, @prev_hash, @anchored_at, @anchor_chain, @anchor_network, @anchor_txn_id)`,
      )
      .run({
        packet_id: receipt.packet_id,
        packet_hash: receipt.packet_hash,
        prev_hash: receipt.prev_hash,
        anchored_at: receipt.anchored_at,
        anchor_chain: receipt.anchor_chain,
        anchor_network: receipt.anchor_network,
        anchor_txn_id: receipt.anchor_txn_id ?? null,
      });
  }

  /** Receipts for a packet, newest last. */
  receiptsFor(packet_id: string): AnchorReceipt[] {
    return this.db
      .prepare(
        "SELECT packet_id, packet_hash, prev_hash, anchored_at, anchor_chain, anchor_network, anchor_txn_id FROM receipts WHERE packet_id = ? ORDER BY seq ASC",
      )
      .all(packet_id)
      .map((r) => {
        const row = r as Omit<AnchorReceipt, "anchor_txn_id"> & { anchor_txn_id: string | null };
        const receipt: AnchorReceipt = {
          packet_id: row.packet_id,
          packet_hash: row.packet_hash,
          prev_hash: row.prev_hash,
          anchored_at: row.anchored_at,
          anchor_chain: row.anchor_chain,
          anchor_network: row.anchor_network,
        };
        if (row.anchor_txn_id) receipt.anchor_txn_id = row.anchor_txn_id;
        return receipt;
      });
  }

  /** The last appended row's hash, or null on an empty log. */
  lastHash(): string | null {
    const row = this.db
      .prepare("SELECT packet_hash FROM events ORDER BY seq DESC LIMIT 1")
      .get() as { packet_hash: string } | undefined;
    return row ? row.packet_hash : null;
  }

  /**
   * Append a new event. Computes the canonical `packet_hash` from the packet+reads, stores the
   * canonical `payload_json`, and links `prev_hash` to the last row's hash. Returns the row.
   */
  append(input: AppendInput): ChainEvent {
    const created_at = input.created_at ?? new Date().toISOString();
    const payload_json = stableStringify({ packet: input.packet, reads: input.reads });
    const packet_hash = computePacketHash({ packet: input.packet, reads: input.reads });
    const prev_hash = this.lastHash();

    this.db
      .prepare(
        `INSERT INTO events (id, kind, packet_id, payload_json, packet_hash, prev_hash, created_at)
         VALUES (@id, @kind, @packet_id, @payload_json, @packet_hash, @prev_hash, @created_at)`,
      )
      .run({
        id: input.id,
        kind: input.kind,
        packet_id: input.packet_id,
        payload_json,
        packet_hash,
        prev_hash,
        created_at,
      });

    return {
      id: input.id,
      kind: input.kind,
      packet_id: input.packet_id,
      payload_json,
      packet_hash,
      prev_hash,
      created_at,
    };
  }

  /** All rows in insertion (chain) order. */
  all(): ChainEvent[] {
    return this.db
      .prepare(
        "SELECT id, kind, packet_id, payload_json, packet_hash, prev_hash, created_at FROM events ORDER BY seq ASC",
      )
      .all() as ChainEvent[];
  }

  /** All rows whose `packet_id` matches, in chain order. */
  byPacketId(packet_id: string): ChainEvent[] {
    return this.db
      .prepare(
        "SELECT id, kind, packet_id, payload_json, packet_hash, prev_hash, created_at FROM events WHERE packet_id = ? ORDER BY seq ASC",
      )
      .all(packet_id) as ChainEvent[];
  }

  /** A single row by its event id. */
  byId(id: string): ChainEvent | undefined {
    return this.db
      .prepare(
        "SELECT id, kind, packet_id, payload_json, packet_hash, prev_hash, created_at FROM events WHERE id = ? ORDER BY seq ASC LIMIT 1",
      )
      .get(id) as ChainEvent | undefined;
  }

  /** Rows that correct (derive from) the given packet id, via stored payload `source_packet_id`. */
  correctionsOf(packet_id: string): ChainEvent[] {
    return this.all().filter((row) => {
      try {
        const payload = JSON.parse(row.payload_json) as {
          packet?: { source_packet_id?: string };
        };
        return payload.packet?.source_packet_id === packet_id;
      } catch {
        return false;
      }
    });
  }

  /**
   * Walk the chain. Returns ok=true with brokenIndex=-1 on an intact chain. On the first
   * failure, returns ok=false and the 0-based index + reason.
   *
   * Two independent checks per row:
   *   1. Self-consistency: re-hash the stored `payload_json`; it must equal the stored
   *      `packet_hash`. (Catches a flipped byte in any payload.)
   *   2. Link: the row's `prev_hash` must equal the previous row's `packet_hash`
   *      (null for the first row).
   */
  verifyChain(): VerifyResult {
    const rows = this.all();
    let prev: string | null = null;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const recomputed = this.rehashPayload(row.payload_json);
      if (recomputed !== row.packet_hash) {
        return {
          ok: false,
          brokenIndex: i,
          reason: `row ${i} (${row.id}): payload hash ${recomputed} != stored ${row.packet_hash}`,
          length: rows.length,
        };
      }
      if (row.prev_hash !== prev) {
        return {
          ok: false,
          brokenIndex: i,
          reason: `row ${i} (${row.id}): prev_hash ${row.prev_hash} != expected ${prev}`,
          length: rows.length,
        };
      }
      prev = row.packet_hash;
    }
    return { ok: true, brokenIndex: -1, length: rows.length };
  }

  /** Re-derive the canonical packet hash from a stored payload row. */
  private rehashPayload(payload_json: string): string {
    const parsed = JSON.parse(payload_json) as { packet: Packet; reads: AgentRead[] };
    return computePacketHash({ packet: parsed.packet, reads: parsed.reads });
  }

  close(): void {
    this.db.close();
  }
}
