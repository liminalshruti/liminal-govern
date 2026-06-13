// Shared fixture loaders + tiny CSV parser (zero-dep). The fixture has no embedded commas,
// so a naive split is safe. Paths resolve relative to ../data.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
export const DATA = join(HERE, "..", "data");

export function parseCsv(path) {
  const text = readFileSync(path, "utf8").trim();
  const [head, ...rows] = text.split(/\r?\n/);
  const cols = head.split(",");
  return rows.filter(Boolean).map((line) => {
    const cells = line.split(",");
    const o = {};
    cols.forEach((c, i) => (o[c] = cells[i]));
    return o;
  });
}

export const loadUsage = () => parseCsv(join(DATA, "usage-events.csv"))
  .map((r) => ({ ...r, est_cost_usd: Number(r.est_cost_usd) }));
export const loadPrs = () => parseCsv(join(DATA, "pr-evidence.csv"));
export const loadJson = (name) => JSON.parse(readFileSync(join(DATA, name), "utf8"));
export const loadOkr = () => loadJson("okr-baseline.json");
export const loadAgents = () => loadJson("agent-registry.json");

// Opus-4.8 spend rolled up by task_category (the governed model only).
export function opusSpendByCategory(usage = loadUsage()) {
  const out = {};
  for (const e of usage) {
    if (e.model !== "claude-opus-4-8") continue;
    out[e.task_category] = (out[e.task_category] || 0) + e.est_cost_usd;
  }
  return out;
}
export const opusTotal = (usage = loadUsage()) =>
  Object.values(opusSpendByCategory(usage)).reduce((a, b) => a + b, 0);

export { existsSync };
