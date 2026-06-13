/**
 * Anchoring — turning a packet hash into a receipt.
 *
 * Local-first by default: `anchorLocal` mints a receipt with `anchor_chain:"local"`,
 * `anchor_network:"local-first"` and NO network. The on-chain path (`anchorOnchain`) is
 * env-gated (`ANCHOR_URL`), best-effort, and never blocks the chain — if it fails or the env
 * is unset, the local receipt still stands.
 *
 * `txidToBytes` + `isZero` are re-implemented clean here (pure, zero-dependency) per the
 * intended lift from `algorand-berlin-2026/apps/router/src/onchain.ts` (public, MIT). The
 * source file was not present in this workspace at build time, so these are written fresh from
 * the documented contract: a 32-byte proof shape (the Algorand txid / hash byte length) is the
 * validity check. See README "Provenance: lifted vs re-implemented".
 */

import type { AnchorReceipt } from "./types.js";

/** Number of bytes in a valid proof (SHA-256 digest / Algorand txid raw length). */
export const PROOF_BYTE_LEN = 32;

/**
 * Decode a 64-char lowercase-hex string into its 32 raw bytes.
 * Throws if the input is not exactly 32 bytes of valid hex — this is the proof-shape gate.
 */
export function txidToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (!/^[0-9a-f]*$/.test(clean)) {
    throw new Error(`txidToBytes: non-hex characters in proof "${hex}"`);
  }
  if (clean.length !== PROOF_BYTE_LEN * 2) {
    throw new Error(
      `txidToBytes: expected ${PROOF_BYTE_LEN}-byte proof (${PROOF_BYTE_LEN * 2} hex chars), got ${clean.length} chars`,
    );
  }
  const bytes = new Uint8Array(PROOF_BYTE_LEN);
  for (let i = 0; i < PROOF_BYTE_LEN; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** True iff every byte is zero — an all-zero proof is never a valid anchor. */
export function isZero(bytes: Uint8Array): boolean {
  for (const b of bytes) {
    if (b !== 0) return false;
  }
  return true;
}

/** Validate a packet hash has the 32-byte, non-zero proof shape. Throws on bad shape. */
export function assertValidProof(packet_hash: string): Uint8Array {
  const bytes = txidToBytes(packet_hash);
  if (isZero(bytes)) {
    throw new Error("anchor: refusing to anchor an all-zero proof");
  }
  return bytes;
}

/**
 * Mint a local-first anchor receipt. No network, never throws on connectivity — only throws if
 * the proof shape is invalid (which is a programmer error, not a runtime condition).
 */
export function anchorLocal(packet_hash: string, prev_hash: string | null): AnchorReceipt {
  assertValidProof(packet_hash);
  return {
    packet_id: "", // filled in by the caller that knows the packet id
    packet_hash,
    prev_hash,
    anchored_at: new Date().toISOString(),
    anchor_chain: "local",
    anchor_network: "local-first",
  };
}

/**
 * Optional on-chain anchor. Env-gated on `ANCHOR_URL`; returns `null` when unset (the common
 * local-first case). Best-effort: any network/HTTP error resolves to `null` rather than
 * throwing, so the chain is never blocked by anchoring.
 */
export async function anchorOnchain(packet_hash: string): Promise<AnchorReceipt | null> {
  const url = process.env.ANCHOR_URL;
  if (!url) return null;
  try {
    assertValidProof(packet_hash);
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ packet_hash }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { txn_id?: string; network?: string };
    return {
      packet_id: "",
      packet_hash,
      prev_hash: null,
      anchored_at: new Date().toISOString(),
      anchor_chain: "algorand",
      anchor_network: body.network ?? "testnet",
      anchor_txn_id: body.txn_id,
    };
  } catch {
    return null; // best-effort: never block on anchoring
  }
}
