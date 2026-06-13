/**
 * Tiny, deterministic CSV reader. Fixtures are simple comma-separated files with a header row and
 * no embedded commas/quotes, so this stays intentionally minimal — no dependency, no surprises.
 */

import { readFileSync } from "node:fs";

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const header = lines[0]!.split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    const row: Record<string, string> = {};
    header.forEach((key, i) => {
      row[key] = cells[i] ?? "";
    });
    return row;
  });
}

export function readCsv(path: string): Record<string, string>[] {
  return parseCsv(readFileSync(path, "utf8"));
}
