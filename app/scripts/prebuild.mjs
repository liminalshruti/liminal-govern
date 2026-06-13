#!/usr/bin/env node
/**
 * prebuild.mjs — runs automatically before `npm run build` (npm `prebuild` lifecycle hook).
 *
 * SINGLE SOURCE OF TRUTH: the engine's `out/report.json` (the SAME artifact the S4
 * deliberation workflow and the pitch deck use). This bakes it into the bundle so the
 * cockpit numbers are byte-identical to the numbers on stage.
 *
 * Strategy:
 *   • FULL REPO (../out/report.json present): copy it → src/generated/report.json.
 *     This is the source of truth; refreshing it re-syncs the cockpit to the engine.
 *   • APP-ONLY (e.g. Vercel with Root Directory = app, ../out absent): use the committed
 *     src/generated/report.json (itself copied from out/report.json at commit time).
 *     Fail loudly only if it is missing (there'd be nothing to ship).
 */

import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, "..");
const REPO = resolve(APP, "..");
const SOURCE = resolve(REPO, "out/report.json");
const BAKED = resolve(APP, "src/generated/report.json");

if (existsSync(SOURCE)) {
  mkdirSync(dirname(BAKED), { recursive: true });
  copyFileSync(SOURCE, BAKED);
  console.log("\n  prebuild: baked out/report.json → src/generated/report.json (single source of truth).\n");
} else if (existsSync(BAKED)) {
  console.log("\n  prebuild: ../out/report.json absent (app-only build) — using committed src/generated/report.json.\n");
} else {
  console.error(
    "\n  prebuild: FATAL — no out/report.json and no committed src/generated/report.json to ship.\n" +
      "  Run the engine to produce out/report.json, then `npm run build`.\n",
  );
  process.exit(1);
}
