#!/usr/bin/env node
/**
 * provenance CLI — drives the chain without a UI dependency.
 *
 *   provenance ingest <findings.json>   append packets/findings + anchor each
 *   provenance verify                   walk the chain, assert integrity
 *   provenance show <id>                print finding + anchor + correction trail
 *   provenance correct <id> <reason>    append a linked correction + re-anchor
 *
 * The log lives at $PROVENANCE_DB (default ./provenance.db). All commands are local-first;
 * the on-chain path is exercised only when ANCHOR_URL is set.
 */

import { readFileSync } from "node:fs";
import { ProvenanceLog } from "./log.js";
import { correct, ingestPacket } from "./correct.js";
import type { Packet } from "./types.js";

const DB_PATH = process.env.PROVENANCE_DB ?? "provenance.db";

function openLog(): ProvenanceLog {
  return new ProvenanceLog(DB_PATH);
}

/** Accepts a single packet, an array of packets, or { packets: [...] }. */
function parseFindings(raw: string): Packet[] {
  const data = JSON.parse(raw) as unknown;
  if (Array.isArray(data)) return data as Packet[];
  if (data && typeof data === "object" && "packets" in data) {
    return (data as { packets: Packet[] }).packets;
  }
  return [data as Packet];
}

async function cmdIngest(file: string): Promise<void> {
  if (!file) throw new Error("usage: provenance ingest <findings.json>");
  const log = openLog();
  try {
    const packets = parseFindings(readFileSync(file, "utf8"));
    for (const packet of packets) {
      const { event, receipt } = await ingestPacket(log, packet);
      console.log(
        `ingested ${event.packet_id}  hash=${event.packet_hash.slice(0, 12)}…  ` +
          `prev=${event.prev_hash ? event.prev_hash.slice(0, 12) + "…" : "GENESIS"}  ` +
          `anchor=${receipt.anchor_chain}/${receipt.anchor_network}`,
      );
    }
    console.log(`\n${packets.length} entr${packets.length === 1 ? "y" : "ies"} appended to ${DB_PATH}`);
  } finally {
    log.close();
  }
}

function cmdVerify(): void {
  const log = openLog();
  try {
    const result = log.verifyChain();
    if (result.ok) {
      console.log(`chain OK — ${result.length} entr${result.length === 1 ? "y" : "ies"}, hash-linked, intact`);
      process.exitCode = 0;
    } else {
      console.error(`chain BROKEN at index ${result.brokenIndex}: ${result.reason}`);
      process.exitCode = 1;
    }
  } finally {
    log.close();
  }
}

function cmdShow(id: string): void {
  if (!id) throw new Error("usage: provenance show <id>");
  const log = openLog();
  try {
    const row = log.byId(id);
    if (!row) {
      console.error(`no entry with id "${id}"`);
      process.exitCode = 1;
      return;
    }
    const payload = JSON.parse(row.payload_json) as { packet: Packet };
    const packet = payload.packet;

    console.log(`── entry ${row.id} (${row.kind}) ──`);
    console.log(`context:    ${packet.context}`);
    console.log(`kind:       ${packet.kind}`);
    if (packet.source_packet_id) console.log(`corrects:   ${packet.source_packet_id}`);
    if (packet.user_correction) console.log(`correction: ${packet.user_correction}`);
    console.log(`hash:       ${row.packet_hash}`);
    console.log(`prev_hash:  ${row.prev_hash ?? "GENESIS"}`);
    console.log(`created:    ${row.created_at}`);

    if (packet.reads?.length) {
      console.log(`\nreads (${packet.reads.length}):`);
      for (const r of [...packet.reads].sort((a, b) => a.ordinal - b.ordinal)) {
        console.log(`  [${r.ordinal}] ${r.agent_name} (${r.archetype}): "${r.quoted}"`);
        if (r.refusal) console.log(`      refusal: ${r.refusal}`);
      }
    }

    const receipts = log.receiptsFor(id);
    console.log(`\nanchors (${receipts.length}):`);
    for (const a of receipts) {
      console.log(
        `  ${a.anchor_chain}/${a.anchor_network} @ ${a.anchored_at}` +
          (a.anchor_txn_id ? `  txn=${a.anchor_txn_id}` : ""),
      );
    }

    const trail = log.correctionsOf(id);
    console.log(`\ncorrection trail (${trail.length}):`);
    for (const c of trail) {
      const cp = (JSON.parse(c.payload_json) as { packet: Packet }).packet;
      console.log(`  → ${c.id} [${cp.correction_kind ?? "?"}]: ${cp.user_correction ?? ""}`);
    }
  } finally {
    log.close();
  }
}

async function cmdCorrect(id: string, reason: string): Promise<void> {
  if (!id || !reason) throw new Error("usage: provenance correct <id> <reason>");
  const log = openLog();
  try {
    const { correction, event, receipt } = await correct(log, id, { reason });
    console.log(
      `correction ${correction.id} appended (corrects ${id})\n` +
        `  kind=${correction.correction_kind}  hash=${event.packet_hash.slice(0, 12)}…  ` +
        `anchor=${receipt.anchor_chain}/${receipt.anchor_network}`,
    );
  } finally {
    log.close();
  }
}

async function main(): Promise<void> {
  const [cmd, ...args] = process.argv.slice(2);
  switch (cmd) {
    case "ingest":
      await cmdIngest(args[0]!);
      break;
    case "verify":
      cmdVerify();
      break;
    case "show":
      cmdShow(args[0]!);
      break;
    case "correct":
      await cmdCorrect(args[0]!, args.slice(1).join(" "));
      break;
    default:
      console.log(
        "provenance — local-first provenance chain\n\n" +
          "  provenance ingest <findings.json>   append packets/findings + anchor each\n" +
          "  provenance verify                   walk the chain, assert integrity\n" +
          "  provenance show <id>                print finding + anchor + correction trail\n" +
          "  provenance correct <id> <reason>    append a linked correction + re-anchor\n\n" +
          `  log: $PROVENANCE_DB (default ./provenance.db) · on-chain: $ANCHOR_URL (optional)`,
      );
      process.exitCode = cmd ? 1 : 0;
  }
}

main().catch((err) => {
  console.error(String(err instanceof Error ? err.message : err));
  process.exitCode = 1;
});
