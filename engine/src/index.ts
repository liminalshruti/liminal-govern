/**
 * @liminal-govern/engine — public API surface.
 *
 * The S4 anchor/report surface and the CLI call into exactly these exports. Three beats:
 *   analyze()        — deterministic seat-utilization audit → SavingsFinding[] + reconcile total
 *   anchorFindings() — commit findings to the local-first provenance chain → AnchorReceipt[]
 *   enforceCap()     — bounded Opus agent that refuses over-cap / out-of-lane spend decisions
 */

export {
  analyze,
  resolveFixture,
  loadUsageEvents,
  HEALTH_THRESHOLD_PCT,
  CANCEL_THRESHOLD_PCT,
} from "./analyze.js";

export {
  anchorFindings,
  reconcileFindings,
  findingToPacket,
} from "./anchor.js";
export type { AnchorOptions, AnchorResult } from "./anchor.js";

export {
  enforceCap,
  applyCapGuard,
  makeOpusRuling,
  ENFORCEMENT_MODEL,
} from "./enforce.js";
export type { EnforceOptions, ModelRuling, RulingFn } from "./enforce.js";

export type {
  AnalysisReport,
  UtilizationRow,
  SpendRow,
  SeatRow,
  UsageEvent,
  SpendDecision,
  Verdict,
  RefusalKind,
  EnforcementVerdict,
} from "./types.js";

// Re-export the provenance seam so S4 can verify chains without a second import path.
export { ProvenanceLog } from "./provenance.js";
export type {
  SavingsFinding,
  AnchorReceipt,
  Packet,
  ReconcileResult,
  VerifyResult,
} from "./provenance.js";
