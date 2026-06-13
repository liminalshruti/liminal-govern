#!/usr/bin/env node
/**
 * prebuild.mjs — runs automatically before `npm run build` (npm `prebuild` lifecycle hook).
 *
 * Goal: bake REAL engine output into the cockpit, while still being deployable from an
 * app-only root (e.g. Vercel with Root Directory = app, where ../engine is not present).
 *
 * Strategy:
 *   • FULL REPO (../engine + ../provenance present): build the provenance lib, build the
 *     engine, then run generate-findings.mjs to (re)bake src/generated/engine-findings.json
 *     from a live analyze() + anchorFindings() run. This is the source of truth.
 *   • APP-ONLY (siblings absent, e.g. Vercel): skip regeneration and use the committed
 *     baked artifact — which itself was produced by the real engine at commit time. Fail
 *     loudly only if the artifact is missing (there'd be nothing to ship).
 *
 * Either way the cockpit ships engine-produced findings + receipts.
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, "..");
const REPO = resolve(APP, "..");
const ENGINE = resolve(REPO, "engine");
const PROVENANCE = resolve(REPO, "provenance");
const ARTIFACT = resolve(APP, "src/generated/engine-findings.json");

function run(cmd, cwd = APP) {
  console.log(`  $ ${cmd}`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

const haveEngine = existsSync(resolve(ENGINE, "package.json"));
const haveProvenance = existsSync(resolve(PROVENANCE, "package.json"));

if (haveEngine && haveProvenance) {
  console.log("\n  prebuild: full repo detected — baking findings from the REAL engine.\n");
  // provenance is the engine's chain dependency; build it first.
  run("npm install", PROVENANCE);
  run("npm run build", PROVENANCE);
  run("npm install", ENGINE);
  run("npm run build", ENGINE);
  run("node scripts/generate-findings.mjs", APP);
} else {
  console.log(
    "\n  prebuild: engine/provenance siblings not present (app-only build, e.g. Vercel).",
  );
  if (!existsSync(ARTIFACT)) {
    console.error(
      "  prebuild: FATAL — no committed src/generated/engine-findings.json to ship.\n" +
        "  Run a full-repo `npm run build` (with ../engine + ../provenance) and commit the artifact.\n",
    );
    process.exit(1);
  }
  console.log("  prebuild: using the committed engine-baked artifact (engine-findings.json).\n");
}
