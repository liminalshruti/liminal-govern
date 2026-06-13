import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalString, computePacketHash, stableStringify } from "../src/hash.js";
import type { AgentRead, Packet } from "../src/types.js";

const reads: AgentRead[] = [
  {
    agent_name: "auditor",
    archetype: "dissent",
    quoted: "12 of 40 seats active",
    situation: "low utilization",
    hidden_risk: "overpay",
    next_move: "downgrade",
    ordinal: 1,
  },
  {
    agent_name: "analyst",
    archetype: "diligence",
    quoted: "$2400/mo plan",
    situation: "enterprise tier",
    hidden_risk: "lock-in",
    next_move: "audit seats",
    ordinal: 0,
  },
];

// A packet with keys in one insertion order.
const packetA: Packet = {
  id: "pkt_1",
  kind: "finding",
  context: "audit of Figma spend",
  reads,
  created_at: "2026-06-13T00:00:00.000Z",
};

// The SAME logical packet with keys inserted in a DIFFERENT order, and reads reversed.
const packetB: Packet = {
  created_at: "2026-06-13T00:00:00.000Z",
  reads: [reads[1]!, reads[0]!],
  context: "audit of Figma spend",
  kind: "finding",
  id: "pkt_1",
};

test("hash determinism: different key insertion order + read order → identical hex (golden vector)", () => {
  const hashA = computePacketHash({ packet: packetA, reads: packetA.reads });
  const hashB = computePacketHash({ packet: packetB, reads: packetB.reads });
  assert.equal(hashA, hashB, "same logical packet must hash identically regardless of key/read order");

  // Golden vector — locks the canonicalization scheme so any divergence is caught.
  assert.equal(hashA, "9001b1477a3c0c37d5f87bf92fa50805144d539fc932317e95f51595ed88cada");
});

test("stableStringify sorts keys at every level", () => {
  const s = stableStringify({ b: 1, a: { d: 2, c: 3 } });
  assert.equal(s, '{"a":{"c":3,"d":2},"b":1}');
});

test("canonical payload excludes anchor concerns and tags the schema", () => {
  const canon = canonicalString({ packet: packetA, reads: packetA.reads });
  assert.ok(canon.includes('"schema":"liminal.provenance.v1"'));
  // No anchor fields can appear — Packet/AgentRead carry none by design.
  assert.ok(!canon.includes("anchor"));
});

test("optional fields resolve to explicit defaults (absent === null)", () => {
  const withDefaults: Packet = { id: "p", kind: "regular", context: "x", reads: [], created_at: "t" };
  const withExplicitNulls: Packet = {
    id: "p",
    kind: "regular",
    context: "x",
    reads: [],
    source_packet_id: undefined,
    user_correction: undefined,
    chosen_agent: null,
    created_at: "t",
  };
  assert.equal(
    computePacketHash({ packet: withDefaults, reads: [] }),
    computePacketHash({ packet: withExplicitNulls, reads: [] }),
  );
});
