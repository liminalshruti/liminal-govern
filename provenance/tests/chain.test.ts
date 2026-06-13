import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { test } from "node:test";
import { ProvenanceLog } from "../src/log.js";
import type { Packet } from "../src/types.js";

function mkPacket(id: string, context: string): Packet {
  return {
    id,
    kind: "finding",
    context,
    reads: [
      {
        agent_name: "analyst",
        archetype: "diligence",
        quoted: `read for ${id}`,
        situation: "s",
        hidden_risk: "r",
        next_move: "m",
        ordinal: 0,
      },
    ],
    created_at: `2026-06-13T00:00:0${id.length}.000Z`,
  };
}

test("verifyChain returns true on a clean, hash-linked log", () => {
  const log = new ProvenanceLog(":memory:");
  const e1 = log.append({ id: "a", kind: "packet", packet_id: "a", packet: mkPacket("a", "first"), reads: mkPacket("a", "first").reads });
  const e2 = log.append({ id: "b", kind: "packet", packet_id: "b", packet: mkPacket("b", "second"), reads: mkPacket("b", "second").reads });
  const e3 = log.append({ id: "c", kind: "packet", packet_id: "c", packet: mkPacket("c", "third"), reads: mkPacket("c", "third").reads });

  // Links: genesis has null prev, each subsequent links to prior hash.
  assert.equal(e1.prev_hash, null);
  assert.equal(e2.prev_hash, e1.packet_hash);
  assert.equal(e3.prev_hash, e2.packet_hash);

  const result = log.verifyChain();
  assert.equal(result.ok, true);
  assert.equal(result.brokenIndex, -1);
  assert.equal(result.length, 3);
  log.close();
});

test("flipping one byte in a payload_json breaks verifyChain at the right index", () => {
  const path = `/tmp/prov-tamper-${Date.now()}.db`;
  const log = new ProvenanceLog(path);
  log.append({ id: "a", kind: "packet", packet_id: "a", packet: mkPacket("a", "first"), reads: mkPacket("a", "first").reads });
  log.append({ id: "b", kind: "packet", packet_id: "b", packet: mkPacket("b", "second"), reads: mkPacket("b", "second").reads });
  log.append({ id: "c", kind: "packet", packet_id: "c", packet: mkPacket("c", "third"), reads: mkPacket("c", "third").reads });
  assert.equal(log.verifyChain().ok, true);
  log.close();

  // Tamper directly in SQLite — flip a byte in the SECOND row's payload (chain index 1).
  // The log API never UPDATEs, so we simulate an external attacker editing the file.
  const raw = new Database(path);
  const row = raw.prepare("SELECT seq, payload_json FROM events ORDER BY seq ASC LIMIT 1 OFFSET 1").get() as {
    seq: number;
    payload_json: string;
  };
  const tampered = row.payload_json.replace("second", "SECOND"); // one logical byte change
  assert.notEqual(tampered, row.payload_json);
  raw.prepare("UPDATE events SET payload_json = ? WHERE seq = ?").run(tampered, row.seq);
  raw.close();

  const reopened = new ProvenanceLog(path);
  const result = reopened.verifyChain();
  assert.equal(result.ok, false);
  assert.equal(result.brokenIndex, 1, "tamper is in the row at chain index 1");
  assert.match(result.reason ?? "", /payload hash/);
  reopened.close();
});

test("log never exposes UPDATE/DELETE; append is the only mutation", () => {
  const log = new ProvenanceLog(":memory:");
  const api = Object.getOwnPropertyNames(Object.getPrototypeOf(log));
  assert.ok(!api.includes("update"));
  assert.ok(!api.includes("delete"));
  assert.ok(api.includes("append"));
  log.close();
});
