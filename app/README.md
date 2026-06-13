# app/ — Streams S3 + S5: the governance cockpit (public slice)

The operator cockpit shown in the demo. **DQ-critical:** all demoed UI must live here (public). The
private `liminal-desktop` (Tauri) internals stay home; what's demoed is built/extracted into this repo.

**Screens (lead with motion, not charts):**
1. Setup / Onboarding (swarm detects MCPs + candidate streams)
2. OKR baseline
3. Tray → Slate (pull diffuse context → harden the working set)
4. Deliberation + Finding (live workflow log + the spend/ROI/misuse finding)
5. **Trustless Agents UI** — the agent registry / fit recommendation (**REUSE + restyle** the public
   `algorand-berlin-2026` asset; note as prior art per `../CONTRIBUTIONS.md`)
6. Ratify + Provenance trail + AI Spend Brief

Consumes the design tokens from `liminal-prototype` and the provenance lib in `../provenance/`. Hero
screen = finding → agent-fit → ratify → it enters the provenance trail. Full spec: private founder-brain
`ops/build-day/streams/S3_DESKTOP_DMG.md` + `S5_DESIGN_SYSTEM_UI.md`.
