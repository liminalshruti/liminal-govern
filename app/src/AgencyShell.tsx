import { useEffect } from "react";
import "./shell/shell.css";
import { SHELL_MARKUP } from "./shell/shellMarkup";
import { initShell } from "./shell/shellInit";

// The converged-IA Agency shell (faithful port of DESKTOP_SHELL_MOCKUP.html): the shell frame
// (governance ribbon + loop spine + left-rail beats + center surfaces + register agency rail +
// provenance chain → sealed ledger), Tray→Slate drag, Today/Mirror, correction-amend, ⌘K palette,
// and relationship-reactive states. report.json is the coherence source of truth (untouched).
let started = false;
export default function AgencyShell() {
  useEffect(() => {
    if (started) return;          // guard React StrictMode double-invoke (the init binds document listeners)
    started = true;
    initShell();
  }, []);
  return <div className="agency-root" dangerouslySetInnerHTML={{ __html: SHELL_MARKUP }} />;
}
