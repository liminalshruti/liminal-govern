import assert from "node:assert/strict";
import { test } from "node:test";
import { anchorLocal, anchorOnchain, assertValidProof, isZero, txidToBytes } from "../src/anchor.js";

const VALID_HASH = "9001b1477a3c0c37d5f87bf92fa50805144d539fc932317e95f51595ed88cada";

test("txidToBytes decodes a 32-byte hex proof", () => {
  const bytes = txidToBytes(VALID_HASH);
  assert.equal(bytes.length, 32);
  assert.equal(bytes[0], 0x90);
});

test("txidToBytes rejects wrong-length and non-hex proofs", () => {
  assert.throws(() => txidToBytes("abcd"), /32-byte proof/);
  assert.throws(() => txidToBytes("z".repeat(64)), /non-hex/);
});

test("isZero detects an all-zero proof", () => {
  assert.equal(isZero(new Uint8Array(32)), true);
  assert.equal(isZero(txidToBytes(VALID_HASH)), false);
});

test("assertValidProof refuses an all-zero proof", () => {
  assert.throws(() => assertValidProof("0".repeat(64)), /all-zero/);
  assert.doesNotThrow(() => assertValidProof(VALID_HASH));
});

test("anchorLocal mints a local-first receipt with no network", () => {
  const r = anchorLocal(VALID_HASH, null);
  assert.equal(r.anchor_chain, "local");
  assert.equal(r.anchor_network, "local-first");
  assert.equal(r.packet_hash, VALID_HASH);
  assert.equal(r.prev_hash, null);
  assert.ok(r.anchored_at);
});

test("anchorOnchain returns null when ANCHOR_URL is unset (local-first default)", async () => {
  const prev = process.env.ANCHOR_URL;
  delete process.env.ANCHOR_URL;
  try {
    const r = await anchorOnchain(VALID_HASH);
    assert.equal(r, null);
  } finally {
    if (prev !== undefined) process.env.ANCHOR_URL = prev;
  }
});

test("anchorOnchain never throws; best-effort returns null on a dead endpoint", async () => {
  const prev = process.env.ANCHOR_URL;
  process.env.ANCHOR_URL = "http://127.0.0.1:1/anchor"; // refused connection
  try {
    const r = await anchorOnchain(VALID_HASH);
    assert.equal(r, null, "a failed on-chain anchor must not block the chain");
  } finally {
    if (prev === undefined) delete process.env.ANCHOR_URL;
    else process.env.ANCHOR_URL = prev;
  }
});
