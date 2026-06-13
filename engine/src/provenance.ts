/**
 * Single seam onto the local-first provenance chain (S1 lib).
 *
 * The library is a sibling package built to `../provenance/dist`. We import it here once via the
 * relative dist path (its package `main` is not wired to the actual emit layout, so we point at the
 * concrete `dist/src/index.js`). Everything else in the engine imports provenance through THIS file,
 * so there is exactly one place that knows where the lib lives.
 *
 * Build it before use:  npm --prefix ../provenance install && npm --prefix ../provenance run build
 */

export {
  ProvenanceLog,
  ingestPacket,
  reconcile,
  computePacketHash,
  anchorLocal,
  correct,
  hashOf,
} from "../../provenance/dist/src/index.js";

export type {
  Packet,
  AgentRead,
  AnchorReceipt,
  Correction,
  SavingsFinding,
  SpendLineItem,
  SeatActivity,
} from "../../provenance/dist/src/index.js";

export type { ReconcileResult } from "../../provenance/dist/src/index.js";
export type { VerifyResult } from "../../provenance/dist/src/index.js";
