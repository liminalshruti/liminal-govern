import { useEffect } from "react";
import "./shell/shell.css";
import { SHELL_MARKUP } from "./shell/shellMarkup";
import { initShell } from "./shell/shellInit";
import { listChain, listProvenance, listCorrections, submitCorrection } from "./lib/provenance";
import { shortHash } from "./lib/format";

// The converged-IA Agency shell (faithful port of DESKTOP_SHELL_MOCKUP.html), now wired to the REAL
// provenance: the chain/ledger render real packet hashes from listChain()/listProvenance(), and
// "Amend this read" appends a real hash-linked correction via submitCorrection(). report.json stays the
// coherence source of truth (gate-guarded). On any load error it falls back to the shell's illustrative
// chain, so the port never breaks.
let started = false;
type ChainRow = [string, string, number, string?];

export default function AgencyShell() {
  useEffect(() => {
    if (started) return; // guard StrictMode double-invoke (init binds document listeners)
    started = true;
    (async () => {
      try {
        const [chain, views, corrections] = await Promise.all([
          listChain(),
          listProvenance(),
          listCorrections(),
        ]);
        const rows: ChainRow[] = [];
        for (const e of chain) {
          const v = views.find((x) => x.finding_id === e.packet_id);
          const title =
            e.kind === "decision"
              ? "ratified · policy anchored to the chain"
              : `finding · ${v?.title ?? e.packet_id}`;
          rows.push([e.created_at.slice(0, 10), title, 0, shortHash(e.packet_hash)]);
        }
        for (const v of views.filter((x) => x.drop_reason)) {
          rows.push(["refuted", `E14 refuted · ${(v.drop_reason ?? "").slice(0, 44)}`, 1, "—"]);
        }
        for (const c of corrections) {
          rows.push([c.created_at.slice(0, 10), `correction · ${c.reason}`, 0, shortHash(c.id)]);
        }
        (window as unknown as { __govChain: ChainRow[] }).__govChain = rows;
        (window as unknown as { __govCorrect: () => Promise<ChainRow> }).__govCorrect = async () => {
          const { correction } = await submitCorrection({
            source_packet_id: "D-RATIFY-CAL",
            correction_kind: "outer",
            reason: "Operator amended the read — the correction is the primary act.",
          });
          return [
            correction.created_at.slice(0, 10),
            `correction · ${correction.reason}`,
            0,
            shortHash(correction.id),
          ];
        };
      } catch {
        /* graceful: the shell uses its illustrative chain if the real data can't load */
      }
      initShell();
    })();
  }, []);
  return <div className="agency-root" dangerouslySetInnerHTML={{ __html: SHELL_MARKUP }} />;
}
