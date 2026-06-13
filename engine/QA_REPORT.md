# QA Report — Backend Spine (build-day/qa-core)

Adversarial QA + hardening of the backend spine only (`provenance/`, `engine/`, `plugin/`).
Date: 2026-06-13. Enforcement model: Opus (`claude-opus-4-8`), verified live.

## Suites — all green

| Suite        | Command                                  | Result                              |
|--------------|------------------------------------------|-------------------------------------|
| provenance   | `cd provenance && npm test`              | **22 passed** (18 baseline + 4 new) |
| provenance   | `cd provenance && npm run typecheck`     | clean                               |
| engine       | `cd engine && npm test`                  | **18 passed** (incl. 2 live Opus)   |
| engine       | `cd engine && npm run typecheck`         | clean                               |
| plugin       | `claude plugin validate ./plugin --strict` | **Validation passed**             |
| plugin       | `node --test plugin/test/*.test.js`      | **5 passed**                        |

## Bugs found + fixed (1)

### BUG-1 — engine demo path broke on a fresh checkout (`cd engine && npm install && npm test`)
- **Symptom:** `engine/src/provenance.ts` imports the sibling library from
  `../../provenance/dist/src/index.js`, but `provenance/dist/` is gitignored and there was
  **no** prebuild hook in `engine/`. A clean `cd engine && npm install && npm test` failed with
  `ERR_MODULE_NOT_FOUND` for `provenance/dist/src/index.js`. The authors documented the manual
  build step in a comment but never automated it — the exact rubric demo path was broken.
- **Repro:** `rm -rf provenance/dist && cd engine && npm test` → module-not-found.
- **Fix (minimal):** added a `build:deps` script to `engine/package.json` plus `pretest` and
  `pretypecheck` hooks that install + build the provenance package first. The demo path now works
  from a clean tree.
- **Caught-by:** verified by deleting `provenance/dist` and re-running `npm test` — the pretest
  hook rebuilds it and all 18 engine tests pass (including the live Opus calls).

## What was probed (and held up — regression tests added to lock it in)

### provenance/
- **Tampering detection at the right index** — already covered (byte flip in row 1 → `brokenIndex 1`).
- **Empty log** → `verifyChain()` returns `{ ok:true, length:0, brokenIndex:-1 }`. *(new test)*
- **Reconcile ±$1 boundary** — the boundary is **inclusive**: `delta == 1` passes, `delta > 1`
  (e.g. 1.01) fails, on both the over and under side. *(new test)*
- **Correction-of-a-correction** — correcting a correction appends a third linked row; the chain
  still verifies and each correction links to its own source (`correctionsOf` resolves per level).
  *(new test)*
- **Duplicate packet ids** — `id` is not a uniqueness constraint; the append-only log keeps both
  rows and the chain still verifies. *(new test)*
- Anchor edge cases (all-zero proof refused, dead endpoint never throws, `ANCHOR_URL` unset →
  local-first) already covered by the baseline suite.

### engine/
- **`analyze` is deterministic + reconciles** — two runs byte-identical; per-finding savings sum
  to the headline total within $1. Covered by baseline.
- **`anchorFindings` → `verifyChain()` true** — hash-linked chain, tamper breaks it. Covered.
- **`enforceCap` refuses over-cap live on Opus** — VERIFIED LIVE: an over-cap decision ($2400 vs
  $1500 cap) is refused with `refusal_kind:"over-cap"`. An under-cap, in-lane decision ($140) is
  **APPROVED** live. *(new live test for the under-cap allow, mirroring the existing over-cap test.)*
- **Forced `tool_choice` is never combined with extended thinking** — the live call sets
  `tool_choice:{type:"tool",name:"record_verdict"}` and carries **no** `thinking` key (the two are
  incompatible). *(new offline guard test that captures the request params via a fake client — would
  catch a regression that re-introduces extended thinking.)*
- **Deterministic cap guard** — over-cap is refused even if the model approves (`source:
  "deterministic-guard"`). Covered by baseline.

### plugin/
- `claude plugin validate ./plugin --strict` → **Validation passed**.
- Bounded agent **refuses out-of-lane**: classifier accepts a well-formed `REFUSE: <RealAgent>` and
  rejects an invented target (`unknown_target`); bounded subagents ship `model: opus` with a tight
  tools allowlist. Covered.
- **`/try-liminal` correction round-trip** works: the runner writes a real deliberation into a plain
  taste vault, `store-correction.js` writes a tagged correction, and it reads back. Covered.
- **No private/secret material leaked:** scanned for live Anthropic key values (the console-key
  prefix pattern), SQLCipher/PRAGMA-key usage, and PEM private-key blocks → none. The vault is a
  clean `node:sqlite` reimplementation (the SQLCipher/Keychain mentions are doc comments stating
  what is explicitly NOT shipped).

## Secret hygiene
- Pre-commit leak check run on the staged diff before commit (grep for the live console-key
  prefix). The only matches in the tree are a documentation prefix reference and a `startsWith(...)`
  detection guard in `plugin/lib/anthropic-client.js` — no real key value is in any tracked file.
