---
name: try-liminal
description: The 60-second taste of Liminal. Runs one bounded deliberation on a sample brief — three agents read the same brief and disagree, at least one refuses out of its lane, you correct one read, and the correction becomes the record. Ends by pointing at the desktop app so the vault outlives the session. Run this first.
disable-model-invocation: true
allowed-tools: Bash(node *)
argument-hint: "[optional: your own brief instead of the sample]"
---

# /try-liminal — see the loop in 60 seconds

This is the taste. Three bounded agents read one brief. They disagree. The one in lane does the work; the others refuse and name the right agent. Then you correct one read — and the correction is the thing Liminal keeps.

Refusal is the feature, not an error.

## Flow

### 1. Run the taste

Run the bundled runner. If the user typed something after `/try-liminal`, pass it as the brief; otherwise the runner uses a built-in sample (a competitive teardown — squarely the Analyst's lane, so the SDR and Auditor have a clean reason to refuse).

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/try-liminal/run.js "$ARGUMENTS"
```

The runner returns JSON:
- `vault_id` — the deliberation row id (written to a throwaway taste vault by default, so this never touches a real vault on first contact)
- `mode` — `live` if it ran the agents on Opus, `fixture` if no Anthropic credential was available (the disagreement still renders; say so honestly)
- `analyst`, `sdr`, `auditor` — each `{ interpretation, refused }`

### 2. Show the disagreement

Render all three reads, labeled. Lead with the in-lane agent (the Analyst, for the sample brief). Show the refusals verbatim — do not paraphrase or soften them. The refusal IS the content.

```
ANALYST (in lane)
[the teardown]

SDR (refused)
REFUSE: Analyst
A competitive teardown is research, not outreach — that's the Analyst's lane.

AUDITOR (refused)
REFUSE: Analyst
Producing the teardown is analysis, not a readiness judgment — that's the Analyst's lane.
```

If `mode` is `fixture`, add one plain line: "(reads shown from a bundled sample — set ANTHROPIC_API_KEY or run `claude setup-token` to run this live on Opus.)"

### 3. Capture one correction

Ask the user, in one line: "Correct one read. What did an agent get wrong?" Accept a short answer (e.g., "the Analyst overstated the AI threat" or "the teardown missed pricing"). Then pick the closest tag from the canonical taxonomy in `lib/correction-tags.js` (the nine tags: wrong_frame, wrong_intensity, wrong_theory, right_but_useless, right_but_already_known, too_generic, missed_compensation, assumes_facts_not_in_evidence, off_by_layer) and store it:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/check/store-correction.js <vault_id> "<agent_name>" <tag> "<reason>"
```

Note: `store-correction.js` validates the agent name against the active agent set and the tag against the frozen taxonomy. For the sample brief the agents are `Analyst`, `SDR`, `Auditor`. If the user skips correcting, that is fine — say so and continue.

### 4. Print the close line

End with exactly this beat (plain text, no embellishment):

> This is the loop. Three agents read, they disagree, you correct one — and the correction is the record. In the terminal the vault is a throwaway. Install the Liminal desktop app to keep your vault. (If the plugin is enabled, the desktop installer was already offered at session start; if the app isn't built yet you'll have seen "Liminal desktop app coming.")

## Voice rules

- Lead with the in-lane agent's actual work.
- Show refusals verbatim. Refusal is content.
- No emoji, no exclamation marks, no "great question."
- Never claim the vault is encrypted-at-rest in this taste — it is a plain local SQLite file in a temp dir. The correction-stream record, not the crypto, is the point here.

## What this skill is not

- Not a chatbot — the agents read once, they do not converse.
- Not an installer — it never installs anything. Install is the desktop app, offered by the SessionStart hook on enable.
- Not a real-vault write by default — it writes to a throwaway taste vault unless `LIMINAL_TRY_REAL_VAULT=1` is set.
