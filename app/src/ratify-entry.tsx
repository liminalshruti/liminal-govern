// ratify-entry.tsx — standalone entry for the Brief Gate ratification surface.
//
// Additive: a second vite page that mounts ONLY the RatifyBrief screen, so the ratification UI is
// reachable + demoable WITHOUT touching the live AgencyShell (the Build-Day cockpit). When the
// surface-host decision is made (govern cockpit vs. liminal-desktop — Sean's call), this screen
// folds into the chosen shell.
import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import { RatifyBrief } from "./screens/RatifyBrief";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <div className="app-shell">
      <main className="main" style={{ maxWidth: 820, margin: "0 auto", padding: "32px 20px" }}>
        <RatifyBrief />
      </main>
    </div>
  </React.StrictMode>,
);
