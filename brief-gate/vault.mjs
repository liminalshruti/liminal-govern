// vault.mjs — Brief Gate M4: the persistent vault + re-entry.
//
// The vault is what makes the wedge COMPOUND: sealed Judgments persist across briefs, and a new
// brief can RE-ENTER prior Judgments — "this was ruled on last month." This is the felt
// accumulation ("the system remembers what survived correction") at M4 grade.
//
// Storage is a simple append-only JSON ledger here (the production vault is the provenance chain;
// M4 proves the re-entry loop). Append-only: corrections/new seals are added, never overwritten.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export function loadVault(vaultPath) {
  if (!existsSync(vaultPath)) return { sealed_briefs: [] };
  return JSON.parse(readFileSync(vaultPath, "utf8"));
}

/** Append a sealed Ratified Brief to the vault (append-only — never rewrites prior seals). */
export function recordSeal(vaultPath, ratifiedBrief, { briefName, sealedAt }) {
  const vault = loadVault(vaultPath);
  vault.sealed_briefs.push({
    brief: briefName,
    sealed_at: sealedAt,
    signature: ratifiedBrief.signature,
    judgments: ratifiedBrief.judgments.map((j) => ({ claim_id: j.claim_id, text: j.text, disposition: j.disposition })),
  });
  mkdirSync(dirname(vaultPath), { recursive: true });
  writeFileSync(vaultPath, JSON.stringify(vault, null, 2) + "\n");
  return vault;
}

/**
 * Re-entry: for each new candidate claim, find a prior sealed Judgment whose subject it references.
 * Returns [{ claim_id, prior: { from_brief, prior_claim_id, prior_text, disposition } }].
 * Matching is keyword-overlap (M4-grade); the production version embeds + matches semantically.
 */
export function findPriorJudgments(vaultPath, claims) {
  const vault = loadVault(vaultPath);
  const priorJudgments = vault.sealed_briefs.flatMap((b) =>
    b.judgments.map((j) => ({ ...j, from_brief: b.brief })),
  );
  const STOP = new Set(["the", "a", "an", "is", "are", "to", "of", "and", "on", "in", "for", "be", "by", "this", "that", "with", "should", "not", "per"]);
  const keywords = (s) =>
    new Set(
      s.toLowerCase().replace(/[^a-z0-9\s$]/g, " ").split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w)),
    );

  const matches = [];
  for (const c of claims) {
    const ck = keywords(c.text);
    let best = null;
    let bestOverlap = 0;
    for (const pj of priorJudgments) {
      const pk = keywords(pj.text);
      let overlap = 0;
      for (const w of ck) if (pk.has(w)) overlap++;
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        best = pj;
      }
    }
    // require a real overlap (≥2 shared salient words) to count as a re-entry
    if (best && bestOverlap >= 2) {
      matches.push({
        claim_id: c.claim_id ?? c.id, // accept both claim shapes (candidate.id / judgment.claim_id)
        prior: {
          from_brief: best.from_brief,
          prior_claim_id: best.claim_id,
          prior_text: best.text,
          disposition: best.disposition,
          shared_terms: bestOverlap,
        },
      });
    }
  }
  return matches;
}
