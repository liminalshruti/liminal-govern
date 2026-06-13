// reconcile() — the core "done" check the S4 workflow's report must pass.
// Savings findings that survive adversarial review (dropped !== true) must sum to the report's
// claimed total within tolerance. Dropped findings (e.g. the E14 calendar-sync trap that the
// reviewer refutes via PR-103) must NOT be counted.
export function reconcile(findings, claimedTotal, tol = 1) {
  const surviving = findings.filter((f) => !f.dropped);
  const sum = surviving.reduce((a, f) => a + (Number(f.monthly_savings) || 0), 0);
  const diff = Math.abs(sum - Number(claimedTotal));
  return { ok: diff <= tol, sum, claimedTotal: Number(claimedTotal), diff, surviving: surviving.length };
}

// Convenience: a finding that cites a given usage event id (used to assert the trap was dropped).
export const findingsCiting = (findings, eventId) =>
  findings.filter((f) => Array.isArray(f.source_row_ids) && f.source_row_ids.includes(eventId));
