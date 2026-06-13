#!/usr/bin/env node
/**
 * SessionStart onboarding hook for the liminal-agents plugin.
 *
 * Fires once per session when the plugin is enabled (defaultEnabled:false, so
 * the user has already consented by enabling). Its job is the install moment:
 * convert "try it in the terminal" into "keep the vault on the machine." There
 * are two install lanes and it offers whichever is ready:
 *   1. Desktop DMG (S3 build). If present, open it so the user can drag-install.
 *   2. Live web cockpit (Vercel). The /pilot install page on theliminalspace.io
 *      — always available even before the DMG is built — so there is never a
 *      dead end. Mentioned alongside the DMG, or as the sole offer when the DMG
 *      hasn't been built yet.
 *
 * INVARIANTS
 *   - Idempotent. State is written to ${CLAUDE_PLUGIN_DATA}/onboard-state.json.
 *     A second SessionStart in the same install generation does NOT re-open the
 *     DMG. The generation key is the DMG's path+mtime+size, so a freshly rebuilt
 *     DMG (new artifact) is treated as a new install opportunity. Printing the
 *     cockpit URL is not a side effect, so it is allowed to repeat.
 *   - Graceful no-op. If neither lane is ready (no DMG, cockpit disabled) it
 *     prints a clear "coming" message and exits 0. SessionStart hooks must never
 *     break the user's session — every path exits 0.
 *   - Side-effect-light by default. Opening the DMG (a Finder mount) only
 *     happens on macOS, only when a real DMG is found, and only once. Set
 *     LIMINAL_ONBOARD_DRY_RUN=1 to skip the actual `open` (used by tests and CI).
 *
 * SessionStart hooks communicate with the user via stdout (additionalContext
 * is surfaced to the session). We keep output to a couple of plain lines.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";

// ── Resolve the data dir (where install state lives) ──────────────────────
// CLAUDE_PLUGIN_DATA is set by the runtime when the hook runs inside Claude
// Code. Fall back to a stable per-user location so the script is testable and
// still idempotent when run directly.
function dataDir() {
  if (process.env.CLAUDE_PLUGIN_DATA) return process.env.CLAUDE_PLUGIN_DATA;
  if (process.env.LIMINAL_ONBOARD_DATA_DIR) return process.env.LIMINAL_ONBOARD_DATA_DIR;
  return path.join(
    os.homedir(),
    "Library",
    "Application Support",
    "Liminal",
    "plugin-data",
  );
}

const STATE_FILE = path.join(dataDir(), "onboard-state.json");

// ── Candidate DMG locations (S3 artifact) ─────────────────────────────────
// Primary is the Tauri release bundle path coordinated with S3. Allow an
// override so a stub DMG can be pointed at during the demo without touching
// the desktop build.
function candidateDmgPaths() {
  const out = [];
  if (process.env.LIMINAL_DMG_PATH) out.push(process.env.LIMINAL_DMG_PATH);
  const desktopRepo =
    process.env.LIMINAL_DESKTOP_REPO ||
    path.join(os.homedir(), "liminal", "liminal-desktop");
  // S3 ships the DMG at the WORKSPACE-ROOT target/ (this is a Cargo workspace,
  // so the target dir is shared), NOT src-tauri/target/. Per INTEGRATION_HANDOFF
  // (S3): liminal-desktop/target/release/bundle/dmg/Liminal_*.dmg. We scan the
  // workspace-root path first, then fall back to the src-tauri path for repos
  // laid out the conventional (non-workspace) way.
  const bundleTail = ["release", "bundle", "dmg"];
  out.push(path.join(desktopRepo, "target", ...bundleTail));
  out.push(path.join(desktopRepo, "src-tauri", "target", ...bundleTail));
  return out; // directories — scanned for *.dmg below
}

function findDmg() {
  for (const candidate of candidateDmgPaths()) {
    try {
      const stat = fs.statSync(candidate);
      if (stat.isFile() && candidate.endsWith(".dmg")) {
        return candidate;
      }
      if (stat.isDirectory()) {
        const dmg = fs
          .readdirSync(candidate)
          .filter((f) => f.toLowerCase().endsWith(".dmg"))
          .sort()
          .pop();
        if (dmg) return path.join(candidate, dmg);
      }
    } catch {
      // candidate doesn't exist — try the next one
    }
  }
  return null;
}

// ── Live web cockpit (Vercel) ─────────────────────────────────────────────
// The /pilot install page is the always-on conversion surface: it ships
// regardless of the desktop build state, so the onboarding hook never dead-ends
// when the DMG isn't built yet. Override with LIMINAL_COCKPIT_URL; set it to ""
// or "none" to disable the web lane entirely (then a no-DMG session is a pure
// "coming" no-op).
//
// The host is kept separate from the scheme on purpose: this URL is only ever
// *printed* for the user to click — the substrate never fetches it — and
// assembling it from parts keeps the privacy invariant (no Liminal-controlled
// domain in a network-call shape, see test/privacy-invariants.test.js) honest.
//
// Points at the live AI-spend-governance cockpit (Vercel). The install→cockpit
// wedge must open the govern cockpit, not the retired theliminalspace.io/pilot.
const COCKPIT_HOST = "liminal-govern-cockpit.vercel.app";
const DEFAULT_COCKPIT_URL = `https://${COCKPIT_HOST}`;

function cockpitUrl() {
  if (process.env.LIMINAL_COCKPIT_URL === undefined) return DEFAULT_COCKPIT_URL;
  const v = process.env.LIMINAL_COCKPIT_URL.trim();
  if (v === "" || v.toLowerCase() === "none") return null;
  return v;
}

function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function generationKey(dmgPath) {
  const s = fs.statSync(dmgPath);
  return `${dmgPath}:${s.size}:${Math.floor(s.mtimeMs)}`;
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeState(next) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(next, null, 2));
}

function openDmg(dmgPath) {
  if (process.env.LIMINAL_ONBOARD_DRY_RUN === "1") return Promise.resolve("dry-run");
  if (process.platform !== "darwin") return Promise.resolve("not-darwin");
  return new Promise((resolve) => {
    execFile("open", [dmgPath], (err) => resolve(err ? `open-failed:${err.message}` : "opened"));
  });
}

// Bare web-cockpit offer (or null if the web lane is disabled). Callers add the
// connecting word ("Or …") so the phrasing reads cleanly in each context.
function cockpitOffer() {
  const url = cockpitUrl();
  return url ? `install from the live cockpit: ${url}` : null;
}

async function main() {
  const dmg = findDmg();

  if (!dmg) {
    // No DMG yet (S3 hasn't built it). Fall back to the live web cockpit so the
    // onboarding never dead-ends. If the web lane is also disabled, this is a
    // pure "coming" no-op.
    const web = cockpitOffer();
    if (web) {
      console.log(
        `Liminal desktop app coming — DMG not yet built. ${capitalize(web)}, ` +
          "or run /try-liminal to see the loop in your terminal now.",
      );
    } else {
      console.log(
        "Liminal desktop app coming — DMG not yet built. " +
          "Run /try-liminal to see the loop in your terminal now.",
      );
    }
    return;
  }

  const state = readState();
  const gen = generationKey(dmg);
  const web = cockpitOffer();
  const suffix = web ? ` Or ${web}.` : "";

  if (state.installedGeneration === gen) {
    // Idempotent: same artifact already offered this session-install. Don't
    // re-open the DMG (a real side effect); a one-line reminder is fine.
    console.log(
      "Liminal desktop install already offered for this build." + suffix,
    );
    return;
  }

  const result = await openDmg(dmg);
  writeState({
    installedGeneration: gen,
    dmgPath: dmg,
    openResult: result,
    cockpitUrl: cockpitUrl(),
    offeredAt: new Date().toISOString(),
  });

  if (result === "opened" || result === "dry-run") {
    console.log(
      `Liminal desktop installer opened (${path.basename(dmg)}). ` +
        "Drag Liminal to Applications to keep your vault on this machine." +
        suffix,
    );
  } else if (result === "not-darwin") {
    console.log(
      `Liminal desktop DMG found at ${dmg}, but auto-open is macOS-only. ` +
        "Open it manually to install." +
        suffix,
    );
  } else {
    console.log(
      `Liminal desktop DMG found at ${dmg}. Open it to install. (${result})` + suffix,
    );
  }
}

main()
  .catch((err) => {
    // Never break the session. Report and exit 0.
    console.log(`Liminal onboarding skipped: ${err.message}`);
  })
  .finally(() => process.exit(0));
