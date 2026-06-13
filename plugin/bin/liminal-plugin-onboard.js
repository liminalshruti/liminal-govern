#!/usr/bin/env node
/**
 * SessionStart onboarding hook for the liminal-govern plugin.
 *
 * Fires once per session when the plugin is enabled (defaultEnabled:false, so
 * the user has already consented by enabling). Its job is the install moment:
 * locate the Liminal desktop DMG produced by the desktop build, and open it so
 * the user can drag-install — the conversion path from "try it in the terminal"
 * to "keep the vault on the machine."
 *
 * INVARIANTS
 *   - Idempotent. State is written to ${CLAUDE_PLUGIN_DATA}/onboard-state.json.
 *     A second SessionStart in the same install generation does NOT re-open the
 *     DMG. The generation key is the DMG's path+mtime+size, so a freshly rebuilt
 *     DMG (new artifact) is treated as a new install opportunity.
 *   - Graceful no-op. If the DMG is absent (the desktop build hasn't produced
 *     one yet) it prints a clear "coming" message and exits 0. SessionStart
 *     hooks must never break the user's session — every path exits 0.
 *   - Side-effect-light by default. Opening the DMG (a Finder mount) only
 *     happens on macOS, only when a real DMG is found, and only once. Set
 *     LIMINAL_ONBOARD_DRY_RUN=1 to skip the actual `open` (used by tests/CI).
 *
 * SessionStart hooks communicate with the user via stdout (additionalContext
 * is surfaced to the session). We keep output to a couple of plain lines.
 *
 * PUBLIC-SAFE: no secrets, no private substrate. This is the plugin front door
 * verbatim from the prior-art liminal-agents substrate (see CONTRIBUTIONS.md).
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

// ── Candidate DMG locations (desktop build artifact) ──────────────────────
// Primary is the Tauri release bundle path. Allow LIMINAL_DMG_PATH to point a
// stub DMG at the demo without touching the desktop build.
function candidateDmgPaths() {
  const out = [];
  if (process.env.LIMINAL_DMG_PATH) out.push(process.env.LIMINAL_DMG_PATH);
  const desktopRepo =
    process.env.LIMINAL_DESKTOP_REPO ||
    path.join(os.homedir(), "liminal", "liminal-desktop");
  // The desktop build ships the DMG at the WORKSPACE-ROOT target/ (this is a
  // Cargo workspace, so the target dir is shared), NOT src-tauri/target/:
  //   liminal-desktop/target/release/bundle/dmg/Liminal_*.dmg
  // We scan the workspace-root path first, then fall back to the src-tauri
  // path for repos laid out the conventional (non-workspace) way.
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

async function main() {
  const dmg = findDmg();

  if (!dmg) {
    // Graceful no-op: the DMG isn't built yet. Tell the user plainly and exit.
    console.log(
      "Liminal desktop app coming — DMG not yet built. " +
        "Run /try-liminal to see the loop in your terminal now.",
    );
    return;
  }

  const state = readState();
  const gen = generationKey(dmg);

  if (state.installedGeneration === gen) {
    // Idempotent: same artifact already offered this session-install. No-op.
    console.log("Liminal desktop install already offered for this build.");
    return;
  }

  const result = await openDmg(dmg);
  writeState({
    installedGeneration: gen,
    dmgPath: dmg,
    openResult: result,
    offeredAt: new Date().toISOString(),
  });

  if (result === "opened" || result === "dry-run") {
    console.log(
      `Liminal desktop installer opened (${path.basename(dmg)}). ` +
        "Drag Liminal to Applications to keep your vault on this machine.",
    );
  } else if (result === "not-darwin") {
    console.log(
      `Liminal desktop DMG found at ${dmg}, but auto-open is macOS-only. ` +
        "Open it manually to install.",
    );
  } else {
    console.log(`Liminal desktop DMG found at ${dmg}. Open it to install. (${result})`);
  }
}

main()
  .catch((err) => {
    // Never break the session. Report and exit 0.
    console.log(`Liminal onboarding skipped: ${err.message}`);
  })
  .finally(() => process.exit(0));
