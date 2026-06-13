import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { shortHash, usd } from "../lib/format";
import { getCorrectionTrail, getRatification } from "../lib/provenance";
import { loadReport } from "../lib/report";

// The hero is a motion-led, 4-act narrative — NOT a dashboard. It walks the core
// loop on the REAL orchestration output:
//   SENSE → AGENT-FIT → THE CATCH (adversarial verify) → RATIFY (→ provenance trail)
// Acts 0–2 auto-advance; the operator ratifies at act 3 and the ratified policy
// materializes in the chain with its real anchor hash.

type Ratification = Awaited<ReturnType<typeof getRatification>>;

interface HeroData {
  totalSpend: number;
  cohort: number;
  calendarClaimed: number;
  calendarVerified: number;
  droppedEvent: string;
  droppedSavings: number;
  policy: string;
  ratification: Ratification | null;
}

// Representative usage events for the SENSE stream (real values from the dataset).
const STREAM = [
  { task: "Build payments API", cat: "product_dev", cost: 420, flag: false },
  { task: "Threat-model auth service", cat: "security_hardening", cost: 300, flag: false },
  { task: "Schedule team offsite + calendar wrangling", cat: "calendar_admin", cost: 90, flag: true },
  { task: "Reformat meeting notes + send calendar invites", cat: "calendar_admin", cost: 90, flag: true },
  { task: "calendar-sync feature: Google Calendar API + UI", cat: "calendar_admin", cost: 180, flag: true },
];

const ACTS = ["Sense", "Agent-fit", "Verify", "Ratify"] as const;

export function Hero() {
  const [act, setAct] = useState(0);
  const [ratified, setRatified] = useState(false);
  const [data, setData] = useState<HeroData | null>(null);

  useEffect(() => {
    (async () => {
      const [report, trail, ratification] = await Promise.all([
        loadReport(),
        getCorrectionTrail(),
        getRatification(),
      ]);
      const cal = report.findings.filter((f) => f.category === "calendar_admin");
      const verified = cal.filter((f) => !f.dropped).reduce((s, f) => s + f.monthly_savings, 0);
      const claimed = cal.reduce((s, f) => s + f.monthly_savings, 0);
      const drop = trail[0];
      setData({
        totalSpend: report.misalignment.opus_total_usd,
        cohort: report.okr_baseline.cohort.length,
        calendarClaimed: claimed,
        calendarVerified: verified,
        droppedEvent: drop?.dropped_event ?? "E14",
        droppedSavings: drop?.dropped_savings ?? 162,
        policy: report.ratified_decision.decision,
        ratification,
      });
    })();
  }, []);

  useEffect(() => {
    if (act >= 3) return;
    const t = setTimeout(() => setAct((a) => Math.min(3, a + 1)), act === 0 ? 2600 : 3200);
    return () => clearTimeout(t);
  }, [act]);

  const replay = () => {
    setRatified(false);
    setAct(0);
  };

  return (
    <div className="hero">
      <div className="hero-top">
        <div className="hero-brand">
          <span className="logo" />
          <span>
            Liminal Govern <small>· AI Spend Cockpit</small>
          </span>
        </div>
        <Link to="/findings">
          <button className="hero-skip">Skip to cockpit →</button>
        </Link>
      </div>

      <div className="hero-stage">
        <div className="hero-inner">
          <div className="hero-eyebrow">
            <span className="step-dots">
              {ACTS.map((_, i) => (
                <i key={i} className={i === act ? "on" : i < act ? "done" : ""} />
              ))}
            </span>
            {ACTS[act]}
          </div>

          {act === 0 && <ActSense data={data} />}
          {act === 1 && <ActAgentFit data={data} />}
          {act === 2 && <ActCatch data={data} />}
          {act === 3 && (
            <ActRatify data={data} ratified={ratified} onRatify={() => setRatified(true)} />
          )}

          <div className="hero-controls">
            {act < 3 ? (
              <>
                <button className="hero-cta accent" onClick={() => setAct((a) => a + 1)}>
                  Continue →
                </button>
                <button className="hero-ghost" onClick={() => setAct(3)}>
                  Skip to ratify
                </button>
              </>
            ) : ratified ? (
              <>
                <Link to="/decisions">
                  <button className="hero-cta accent">See it in the decision log →</button>
                </Link>
                <Link to="/findings">
                  <button className="hero-ghost">Open findings</button>
                </Link>
                <button className="hero-ghost" onClick={replay}>↺ Replay</button>
              </>
            ) : (
              <button className="hero-ghost" onClick={replay}>↺ Replay</button>
            )}
          </div>
        </div>
      </div>

      <div className="hero-foot">
        <span>Evidence, not assertion — every call cites its source and anchors to a hash-chain.</span>
        <div className="nav-pills">
          <Link to="/spend">Spend</Link>
          <Link to="/findings">Findings</Link>
          <Link to="/governance">Governance</Link>
          <Link to="/decisions">Decisions</Link>
        </div>
      </div>
    </div>
  );
}

// ── ACT 0 — SENSE ─────────────────────────────────────────────
function ActSense({ data }: { data: HeroData | null }) {
  const total = data?.totalSpend ?? 4500;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    setShown(0);
    const iv = setInterval(() => setShown((n) => (n >= STREAM.length ? n : n + 1)), 320);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="act">
      <h1>This month, one model ran everything.</h1>
      <p className="lead">
        A {data?.cohort ?? 7}-person cohort on early-access <b>Opus 4.8</b>. The cockpit senses
        every session — and watches where frontier spend goes to work it doesn't need to do.
      </p>
      <div className="act-card">
        <div className="spend-ticker">
          <span className="big">{usd(total)}</span>
          <span className="cap">Opus 4.8 · June 2026 · {data?.cohort ?? 7} engineers</span>
        </div>
        <div className="usage-stream">
          {STREAM.slice(0, shown).map((e, i) => (
            <div key={i} className={`usage-row${e.flag ? " flag" : ""}`}>
              <span className="task">{e.task}</span>
              <span className="cat">{e.cat}</span>
              <span className="cost">{usd(e.cost)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ACT 1 — AGENT-FIT ─────────────────────────────────────────
function ActAgentFit({ data }: { data: HeroData | null }) {
  const claimed = data?.calendarClaimed ?? 324;
  return (
    <div className="act">
      <h1>Frontier spend, routine work.</h1>
      <p className="lead">
        Opus 4.8 is doing <b>calendar admin</b> — scheduling, invites. A verified internal agent
        already owns that lane, at a fraction of the cost.
      </p>
      <div className="act-card">
        <div className="fit-row">
          <div className="fit-from">
            <span className="fit-model">Claude Opus 4.8</span>
            <span className="fit-sub">frontier tier · calendar_admin</span>
          </div>
          <span className="fit-arrow">→</span>
          <div className="fit-to">
            <span className="fit-model">CalendarOps Agent</span>
            <span className="fit-sub">~10% of Opus cost</span>
            <span className="fit-verified">● registry-verified (Algorand trustless registry)</span>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="savings-pop">{usd(claimed)}/mo</div>
            <div className="fit-sub">claimed savings</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ACT 2 — THE CATCH (adversarial verify) ────────────────────
function ActCatch({ data }: { data: HeroData | null }) {
  const claimed = data?.calendarClaimed ?? 324;
  const verified = data?.calendarVerified ?? 162;
  const ev = data?.droppedEvent ?? "E14";
  const dropped = data?.droppedSavings ?? 162;
  return (
    <div className="act">
      <h1>Then the model caught its own error.</h1>
      <p className="lead">
        An adversarial reviewer cross-checks every claim against the evidence — and refuses to
        inflate the number.
      </p>
      <div className="act-card catch">
        <div className="verifier-line">
          <span className="pulse" /> Adversarial reviewer · cross-check vs PR evidence
        </div>
        <p className="evidence-note">
          <code>{ev}</code> ($180) was labeled <code>calendar_admin</code> — but <b>PR-103</b> proves
          it's a shipped product feature (<i>Google Calendar API + UI</i>), not admin. The reviewer{" "}
          <b>refutes</b> the <b>{usd(dropped)}</b> claim and drops it.
        </p>
        <div className="savings-correct">
          <span className="was">{usd(claimed)}/mo</span>
          <span className="now">{usd(verified)}/mo verified</span>
        </div>
        <p className="moral">
          The dropped claim is recorded, not hidden — honesty is part of the provenance.
        </p>
      </div>
    </div>
  );
}

// ── ACT 3 — RATIFY → provenance trail ─────────────────────────
function ActRatify({
  data,
  ratified,
  onRatify,
}: {
  data: HeroData | null;
  ratified: boolean;
  onRatify: () => void;
}) {
  const verified = data?.calendarVerified ?? 162;
  const r = data?.ratification ?? null;
  return (
    <div className="act">
      <h1>You decide. The chain remembers.</h1>
      <p className="lead">
        One ratification turns a verified finding into enforced policy — and writes itself into the
        provenance trail, anchored.
      </p>
      <div className="act-card">
        <div className="ratify-policy">
          Opus 4.8 <span className="neq">≠</span> calendar management — route to CalendarOps.
        </div>
        <div className="fit-sub">
          Verified realizable savings · {usd(verified)}/mo · registry-verified agent
        </div>

        {!ratified ? (
          <div className="hero-controls" style={{ marginTop: 18 }}>
            <button className="hero-cta accent" onClick={onRatify}>
              Ratify this policy →
            </button>
          </div>
        ) : (
          <div className="trail-entry">
            <div className="th">✓ Ratified — appended to the provenance chain &amp; anchored</div>
            <div className="kv">
              <span>policy</span>
              <b>{r?.policy ?? "Opus 4.8 cannot be used for calendar management or routine admin work."}</b>
              <span>packet_id</span>
              <b>{r?.id ?? "D-RATIFY-CAL"}</b>
              <span>packet_hash</span>
              <b>{r?.packet_hash ?? "—"}</b>
              <span>prev_hash</span>
              <b>{shortHash(r?.prev_hash)}</b>
              <span>anchor</span>
              <b>
                {r?.receipt?.anchor_chain ?? "local"} · {r?.receipt?.anchor_network ?? "local-first"}
              </b>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
