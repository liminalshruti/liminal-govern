// The S4 "done" gate. Validates the workflow's report (out/report.json) against the 5 rubric checks.
// Skips gracefully until U1's /spend-audit workflow emits the report — then it's a hard gate.
// Set REPORT_PATH to point elsewhere. Expected report shape (what U1 builds the workflow to emit):
//   { okr_baseline, classified_usage:[{event_id, category, objective_id|null, source_row}],
//     misalignment:{security_actual_pct, security_target_pct, ...},
//     findings:[{finding_id, type, monthly_savings, source_row_ids:[...], dropped?, drop_reason?}],
//     ratified_decision:{ agent_policy, approved_alternative, ... },
//     total_recommended_savings, report_citations:[...] }
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { reconcile, findingsCiting } from "./reconcile.js";
import { loadUsage } from "./helpers.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPORT_PATH = process.env.REPORT_PATH || join(HERE, "..", "out", "report.json");

test(
  "S4 report satisfies the 5 rubric checks",
  { skip: !existsSync(REPORT_PATH) && "no report yet — U1's /spend-audit workflow must emit out/report.json (or set REPORT_PATH)" },
  () => {
    const r = JSON.parse(readFileSync(REPORT_PATH, "utf8"));

    // (1) OKR baseline exists
    assert.ok(r.okr_baseline?.objectives?.length, "okr_baseline with objectives");

    // (2) every usage event classified against the OKRs
    const usageIds = new Set(loadUsage().map((e) => e.event_id));
    const classifiedIds = new Set((r.classified_usage || []).map((c) => c.event_id));
    for (const id of usageIds) assert.ok(classifiedIds.has(id), `usage event ${id} must be classified`);

    // (3) misalignment detected — security under its 40% target
    assert.ok(
      Number(r.misalignment?.security_actual_pct) < Number(r.misalignment?.security_target_pct),
      "security under-allocation must be detected"
    );

    // (4) a ratified decision written to the provenance trail (policy + approved alternative)
    assert.ok(r.ratified_decision?.agent_policy, "ratified decision must carry an agent_policy");
    assert.ok(r.ratified_decision?.approved_alternative, "ratified decision must name the approved alternative");

    // (5) report cites sources AND savings reconcile ±$1 with the E14 trap dropped
    assert.ok((r.report_citations || []).length, "report must cite its sources");
    const rec = reconcile(r.findings || [], r.total_recommended_savings, 1);
    assert.ok(rec.ok, `recommended savings must reconcile +/-$1: ${JSON.stringify(rec)}`);
    const e14 = findingsCiting(r.findings || [], "E14");
    assert.ok(e14.length > 0 && e14.every((f) => f.dropped), "the E14 calendar-sync trap finding must be dropped, not counted");
  }
);
