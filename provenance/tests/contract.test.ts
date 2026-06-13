import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { test } from "node:test";

/**
 * Drift guard: the wire types mirrored into `src/types.ts` MUST stay field-for-field identical
 * to the canonical contract at `../../coordination/contract.ts`. We do NOT import the contract as
 * a module (that would pull a file outside this self-contained package's rootDir); we read both
 * files as text, extract each shared interface/type body, normalize away comments + whitespace,
 * and assert equality. Any divergence fails here and must be reconciled TOWARD the contract.
 */

const here = dirname(fileURLToPath(import.meta.url));
const contractPath = resolve(here, "../../coordination/contract.ts");
const typesPath = resolve(here, "../src/types.ts");

const SHARED = [
  "PacketKind",
  "CorrectionKind",
  "AgentRead",
  "Packet",
  "AnchorReceipt",
  "Correction",
  "SpendLineItem",
  "SeatActivity",
  "SavingsFinding",
] as const;

/** Strip line comments + collapse whitespace so we compare type SHAPE, not formatting/docs. */
function norm(s: string): string {
  return s.replace(/\/\/.*$/gm, "").replace(/\s+/g, " ").trim();
}

/** Extract the body of `export interface Name { ... }` or `export type Name = ...;`. */
function shapeOf(src: string, name: string): string | null {
  const iface = new RegExp(`export interface ${name}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(src);
  if (iface) return norm(iface[1]!);
  const alias = new RegExp(`export type ${name}\\s*=([\\s\\S]*?);`).exec(src);
  if (alias) return norm(alias[1]!);
  return null;
}

test("mirrored wire types are byte-identical (sans comments) to coordination/contract.ts", () => {
  const contract = readFileSync(contractPath, "utf8");
  const types = readFileSync(typesPath, "utf8");

  for (const name of SHARED) {
    const c = shapeOf(contract, name);
    const t = shapeOf(types, name);
    assert.ok(c, `contract.ts is missing shared type ${name}`);
    assert.ok(t, `src/types.ts is missing shared type ${name}`);
    assert.equal(t, c, `type ${name} has drifted from coordination/contract.ts — reconcile toward the contract`);
  }
});
