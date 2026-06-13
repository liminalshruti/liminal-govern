import { Link } from "react-router-dom";
import { usd } from "../lib/format";
import { engineReport, getRatification } from "../lib/provenance";

const RATIFY = getRatification();

// Hero / landing — the AI-spend governance story in one screen, on real numbers
// from the S4 deliberation: Opus 4.8 spend, the verified savings after the
// adversarial reviewer dropped the E14 claim, and the ratified policy.
export function Hero() {
  return (
    <div className="hero">
      <div className="inner">
        <h1>AI spend governance for founder/operators</h1>
        <p>
          One model — <strong>{engineReport.governed_model}</strong> — ran a whole team this month
          ({usd(engineReport.opus_total)}/mo). Liminal Govern senses every session, finds where
          frontier spend should route to cheaper <em>verified</em> agents, lets an adversarial
          reviewer drop its own bad claims, and proves every call with a hash-chain.
        </p>

        <div className="grid cols-3" style={{ margin: "28px 0", textAlign: "left" }}>
          <div className="card stat">
            <span className="label">Naive savings</span>
            <span className="value" style={{ color: "var(--muted)" }}>{usd(engineReport.naive_savings)}/mo</span>
          </div>
          <div className="card stat">
            <span className="label">Dropped by reviewer</span>
            <span className="value" style={{ color: "var(--bad)" }}>−{usd(engineReport.dropped_total)}</span>
          </div>
          <div className="card stat">
            <span className="label">Verified realizable</span>
            <span className="value" style={{ color: "var(--good)" }}>{usd(engineReport.monthly_savings_total)}/mo</span>
          </div>
        </div>

        <p style={{ fontWeight: 600 }}>
          Ratified: “{RATIFY.decision}”
        </p>

        <Link to="/findings" className="cta">
          See the findings →
        </Link>
        <p className="design-note">
          The adversarial reviewer caught its own error: E14 looked like calendar admin, but PR-103
          proved it was product work — so the {usd(engineReport.dropped_total)} claim was dropped.
          Evidence, not assertion.
        </p>
      </div>
    </div>
  );
}
