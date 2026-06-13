export function PageHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <header>
      <h1>{title}</h1>
      {sub && <p className="page-sub">{sub}</p>}
    </header>
  );
}
