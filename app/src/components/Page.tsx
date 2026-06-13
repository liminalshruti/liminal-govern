import type { ReactNode } from "react";

export function PageHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <header>
      <h1>{title}</h1>
      {sub && <p className="page-sub">{sub}</p>}
    </header>
  );
}

/** Marks a screen as a stub so reviewers/design know it's intentionally minimal. */
export function StubBanner({ children }: { children: ReactNode }) {
  return <div className="stub-banner">STUB · {children}</div>;
}
