import { Link } from "react-router-dom";

// Hero / landing placeholder. Lane C (design) replaces the visuals; keep copy
// minimal and on-message (sense → examine → decide → prove).
export function Hero() {
  return (
    <div className="hero">
      <div className="inner">
        <h1>AI spend governance for founder/operators</h1>
        <p>
          Sense your software and AI spend, examine where seats outrun activity,
          decide what to right-size, and prove every call with a provenance trail
          you can hand to anyone.
        </p>
        <Link to="/findings" className="cta">
          See the findings →
        </Link>
        <p className="design-note">
          Skeleton build. Hero visuals + S4 deliberation workflow land later (lanes C / A).
        </p>
      </div>
    </div>
  );
}
