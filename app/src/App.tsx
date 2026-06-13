import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { Hero } from "./screens/Hero";
import { SpendOverview } from "./screens/SpendOverview";
import { Findings } from "./screens/Findings";
import { AgentRegistry } from "./screens/AgentRegistry";
import { Governance } from "./screens/Governance";
import { DecisionLog } from "./screens/DecisionLog";

interface NavItem {
  to: string;
  label: string;
  step: string;
}

// The cockpit screens, in pitch order (hero lives outside the shell at "/").
const NAV: NavItem[] = [
  { to: "/spend", label: "Spend overview", step: "1" },
  { to: "/findings", label: "Findings & corrections", step: "2" },
  { to: "/governance", label: "Governance & cap", step: "3" },
  { to: "/agents", label: "Approved agents", step: "4" },
  { to: "/decisions", label: "Decision log", step: "5" },
];

function Shell() {
  return (
    <div className="app-shell">
      <nav className="sidebar">
        <NavLink to="/" className="brand">
          Liminal Govern
          <small>AI Spend Governance</small>
        </NavLink>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            <span className="step">{n.step}</span>
            {n.label}
          </NavLink>
        ))}
        <div className="sidebar-foot mono">
          source of truth · out/report.json
        </div>
      </nav>
      <main className="main">
        <Routes>
          <Route path="/spend" element={<SpendOverview />} />
          <Route path="/findings" element={<Findings />} />
          <Route path="/governance" element={<Governance />} />
          <Route path="/agents" element={<AgentRegistry />} />
          <Route path="/decisions" element={<DecisionLog />} />
          <Route path="*" element={<Navigate to="/spend" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Hero />} />
      <Route path="/*" element={<Shell />} />
    </Routes>
  );
}
