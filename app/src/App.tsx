import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { Hero } from "./screens/Hero";
import { SpendOverview } from "./screens/SpendOverview";
import { Utilization } from "./screens/Utilization";
import { Findings } from "./screens/Findings";
import { AgentRegistry } from "./screens/AgentRegistry";
import { AgentFit } from "./screens/AgentFit";
import { Governance } from "./screens/Governance";
import { DecisionLog } from "./screens/DecisionLog";

interface NavItem {
  to: string;
  label: string;
}

// The 6 cockpit screens (hero lives outside the shell at "/").
const NAV: NavItem[] = [
  { to: "/spend", label: "Spend overview" },
  { to: "/utilization", label: "Seat vs. activity" },
  { to: "/findings", label: "Findings" },
  { to: "/agents", label: "Agent registry" },
  { to: "/agent-fit", label: "Agent fit" },
  { to: "/governance", label: "Governance state" },
  { to: "/decisions", label: "Decision log" },
];

function Shell() {
  return (
    <div className="app-shell">
      <nav className="sidebar">
        <NavLink to="/" className="brand">
          Liminal Govern
          <small>AI Spend Cockpit</small>
        </NavLink>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            {n.label}
          </NavLink>
        ))}
      </nav>
      <main className="main">
        <Routes>
          <Route path="/spend" element={<SpendOverview />} />
          <Route path="/utilization" element={<Utilization />} />
          <Route path="/findings" element={<Findings />} />
          <Route path="/agents" element={<AgentRegistry />} />
          <Route path="/agent-fit" element={<AgentFit />} />
          <Route path="/governance" element={<Governance />} />
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
