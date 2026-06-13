#!/usr/bin/env node
/**
 * capture-beats.mjs — fallback demo screenshots (Build Day 2026-06-13).
 *
 * Builds (if needed) + serves the production bundle and screenshots the 4 hero
 * beats into app/demo-shots/, so the demo survives a live Vercel blip:
 *
 *   0. hero            — the beat: agents disagree → operator corrects → anchor
 *   1. spend-overview  — Opus 4.8 spend classified against the OKRs
 *   2. finding         — a finding with cited evidence + provenance anchor
 *   3. correction      — a signed correction re-anchored onto the chain
 *   4. governance      — the ratified cap-refusal + chain integrity
 *
 * Usage:  npm run build && npm run capture-beats
 * Prereq: npx playwright install chromium  (one-time browser download)
 */

import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, "..");
const SHOTS = resolve(APP, "demo-shots");
const PORT = 4178;
const BASE = `http://localhost:${PORT}`;

mkdirSync(SHOTS, { recursive: true });

function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  return new Promise((res, rej) => {
    const tick = async () => {
      try {
        const r = await fetch(url);
        if (r.ok) return res();
      } catch {
        /* not up yet */
      }
      if (Date.now() - start > timeoutMs) return rej(new Error("preview server timeout"));
      setTimeout(tick, 250);
    };
    tick();
  });
}

async function main() {
  console.log("  ▸ serving dist via vite preview…");
  const server = spawn(
    "npx",
    ["vite", "preview", "--port", String(PORT), "--strictPort"],
    { cwd: APP, stdio: "ignore" },
  );

  try {
    await waitForServer(BASE);
    const browser = await chromium.launch();
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });

    // 0 — hero (the beat)
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    await page.screenshot({ path: resolve(SHOTS, "0-hero.png") });
    console.log("  ✓ 0-hero.png");

    // 1 — spend overview
    await page.getByRole("link", { name: /Start at spend overview/i }).click();
    await page.waitForSelector("table");
    await page.waitForTimeout(300);
    await page.screenshot({ path: resolve(SHOTS, "1-spend-overview.png"), fullPage: true });
    console.log("  ✓ 1-spend-overview.png");

    // 2 — findings (finding with evidence + provenance anchor)
    await page.getByRole("link", { name: /Findings & corrections/i }).click();
    await page.waitForSelector(".finding-card");
    await page.waitForTimeout(400);
    await page.screenshot({ path: resolve(SHOTS, "2-finding-provenance.png"), fullPage: true });
    console.log("  ✓ 2-finding-provenance.png");

    // 3 — correction / re-anchor
    await page.getByRole("button", { name: /Correct this finding/i }).first().click();
    await page.locator(".finding-card textarea").first().fill(
      "Confirmed off-objective: route to CalendarOps and apply the ratified cap.",
    );
    await page.getByRole("button", { name: /Sign correction/i }).click();
    await page.waitForSelector(".done-note");
    await page.waitForTimeout(400);
    await page.screenshot({ path: resolve(SHOTS, "3-correction-reanchor.png"), fullPage: true });
    console.log("  ✓ 3-correction-reanchor.png");

    // 4 — governance cap-refusal
    await page.getByRole("link", { name: /Governance & cap/i }).click();
    await page.waitForSelector(".refusal-card");
    await page.waitForTimeout(400);
    await page.screenshot({ path: resolve(SHOTS, "4-governance-cap.png"), fullPage: true });
    console.log("  ✓ 4-governance-cap.png");

    await browser.close();
    console.log("\n  ✓ 5 beat screenshots → app/demo-shots/\n");
  } finally {
    server.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
