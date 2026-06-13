import { Link } from "react-router-dom";
import { reportSummary } from "../lib/provenance";
import { usd } from "../lib/format";

// Hero / landing — opens ON the beat: agents disagree → operator corrects →
// the correction is what gets anchored. Numbers are baked from out/report.json.
export function Hero() {
  const s = reportSummary;
  return (
    <div className="hero">
      <div className="hero-grid">
        {/* Left: the thesis + headline numbers */}
        <div className="hero-lede">
          <span className="eyebrow">AI spend governance · for founder/operators</span>
          <h1>
            Govern your AI spend like
            <br />
            you govern your books.
          </h1>
          <p>
            Every Opus 4.8 call is classified against your OKRs, off-objective work is
            routed to cheaper verified agents, and <strong>every finding cites its
            evidence and carries a provenance anchor</strong> you can hand to anyone.
          </p>

          <div className="hero-stats">
            <div className="hero-stat">
              <span className="num">{usd(s.opus_total_usd)}</span>
              <span className="lbl">Opus 4.8 spend · {s.period}</span>
            </div>
            <div className="hero-stat">
              <span className="num good">{usd(s.ratified_savings)}/mo</span>
              <span className="lbl">ratified savings (evidence-backed)</span>
            </div>
            <div className="hero-stat">
              <span className="num warn">−{usd(s.dropped_usd)}</span>
              <span className="lbl">over-claim refuted &amp; dropped</span>
            </div>
          </div>

          <div className="hero-cta">
            <Link to="/findings" className="cta primary">
              See the finding &amp; its correction →
            </Link>
            <Link to="/spend" className="cta ghost">
              Start at spend overview
            </Link>
          </div>
        </div>

        {/* Right: the beat itself — disagree → correct → anchor */}
        <div className="beat-card">
          <div className="beat-step">
            <span className="dot find" />
            <div>
              <span className="k">FINDING · F-E14</span>
              <p>
                Auditor flagged Priya's <em>“calendar-sync feature”</em> (E14) as
                calendar admin → route to CalendarOps, claim{" "}
                <strong>{usd(162)}/mo</strong>.
              </p>
            </div>
          </div>
          <div className="beat-connector">agents disagreed</div>
          <div className="beat-step">
            <span className="dot correct" />
            <div>
              <span className="k">CORRECTION · adversarial review</span>
              <p>
                PR-103 proves E14 is <strong>product engineering</strong> (Google
                Calendar API + UI) on the approved track — not admin. The{" "}
                {usd(162)} routing claim is <strong>dropped</strong>.
              </p>
            </div>
          </div>
          <div className="beat-connector">so we only anchor what survives</div>
          <div className="beat-step">
            <span className="dot anchor" />
            <div>
              <span className="k">ANCHORED · SHA-256 chain</span>
              <p>
                {usd(s.ratified_savings)}/mo of findings — each citing its evidence
                rows — hash-linked &amp; re-verified in your browser.
              </p>
            </div>
          </div>
          <div className="beat-foot mono">
            naive {usd(s.naive_savings)} → ratified {usd(s.ratified_savings)} · the
            difference is what we refused to claim
          </div>
        </div>
      </div>
    </div>
  );
}
