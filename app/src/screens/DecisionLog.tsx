import { useEffect, useState } from "react";
import { PageHeader } from "../components/Page";
import { shortHash } from "../lib/format";
import type { Correction } from "../lib/contract";
import {
  getCorrectionTrail,
  getRatification,
  listChain,
  listCorrections,
  listProvenance,
  type ProvenanceView,
} from "../lib/provenance";

type ChainEntry = Awaited<ReturnType<typeof listChain>>[number];
type Trail = Awaited<ReturnType<typeof getCorrectionTrail>>;
type Ratification = Awaited<ReturnType<typeof getRatification>>;

// Decision log: the append-only trail from the REAL S4 provenance chain. Anchored
// findings + the ratified policy are first-class linked entries, each with a real
// packet_hash and prev_hash. The verifier's dropped claim is recorded (refuted,
// never anchored). Corrections signed this session append on top with a real hash.
export function DecisionLog() {
  const [chain, setChain] = useState<ChainEntry[]>([]);
  const [views, setViews] = useState<ProvenanceView[]>([]);
  const [trail, setTrail] = useState<Trail>([]);
  const [ratification, setRatification] = useState<Ratification | null>(null);
  const [session, setSession] = useState<Correction[]>([]);

  useEffect(() => {
    listChain().then(setChain);
    listProvenance().then(setViews);
    getCorrectionTrail().then(setTrail);
    getRatification().then(setRatification);
    setSession(listCorrections());
  }, []);

  const titleOf = (e: ChainEntry): string => {
    if (e.kind === "decision") return ratification?.policy ?? "Ratified policy";
    return views.find((x) => x.finding_id === e.packet_id)?.title ?? e.packet_id;
  };

  const kindBadge = (e: ChainEntry) =>
    e.kind === "decision" ? (
      <span className="badge accent dot">ratification</span>
    ) : (
      <span className="badge good dot">finding</span>
    );

  return (
    <>
      <PageHeader
        title="Decision log"
        sub="Append-only trail. Every surviving finding entered the chain; the ratified policy is a new linked entry; the refuted claim is recorded, never silently dropped. Real SHA-256 anchors, hash-linked."
      />

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>When</th>
              <th>Kind</th>
              <th>Entry</th>
              <th>packet_hash</th>
              <th>prev_hash</th>
            </tr>
          </thead>
          <tbody>
            {chain.map((e, i) => (
              <tr key={e.id}>
                <td className="mono">{i}</td>
                <td className="mono">{e.created_at.slice(0, 10)}</td>
                <td>{kindBadge(e)}</td>
                <td>{titleOf(e)}</td>
                <td className="mono">{shortHash(e.packet_hash)}</td>
                <td className="mono">{shortHash(e.prev_hash)}</td>
              </tr>
            ))}
            {trail.map((t) => (
              <tr key={t.finding_id}>
                <td className="mono">—</td>
                <td className="mono">2026-06-13</td>
                <td><span className="badge bad dot">refuted</span></td>
                <td>{t.drop_reason}</td>
                <td className="mono" colSpan={2}>dropped — not anchored ({t.dropped_event}, −${t.dropped_savings})</td>
              </tr>
            ))}
            {session.map((c, i) => (
              <tr key={c.id}>
                <td className="mono">{chain.length + i}</td>
                <td className="mono">{c.created_at.slice(0, 10)}</td>
                <td><span className="badge warn dot">correction · {c.correction_kind}</span></td>
                <td>{c.reason} <span className="mono">→ {c.source_packet_id}</span></td>
                <td className="mono" colSpan={2}>signed this session</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="page-sub" style={{ marginTop: 16 }}>
        {chain.length} anchored entries · {trail.length} refuted · {session.length} signed this
        session. Corrections you sign on the{" "}
        <a href="/findings" style={{ color: "var(--accent)" }}>Findings</a> screen append here with a real hash.
      </p>
    </>
  );
}
