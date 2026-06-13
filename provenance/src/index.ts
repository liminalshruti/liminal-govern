/**
 * liminal-provenance — local-first provenance chain.
 *
 * Public API surface. Downstream streams import from here (or from the individual modules).
 */

export * from "./types.js";
export {
  stableStringify,
  canonicalString,
  canonicalPacketPayload,
  computePacketHash,
  sha256Hex,
  PACKET_HASH_SCHEMA,
} from "./hash.js";
export { ProvenanceLog } from "./log.js";
export type { VerifyResult } from "./log.js";
export {
  anchorLocal,
  anchorOnchain,
  txidToBytes,
  isZero,
  assertValidProof,
  PROOF_BYTE_LEN,
} from "./anchor.js";
export {
  ingestPacket,
  correct,
  reconcile,
  hashOf,
} from "./correct.js";
export type { IngestResult, CorrectResult, ReconcileResult } from "./correct.js";
