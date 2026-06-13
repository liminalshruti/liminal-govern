export const usd = (n: number): string =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const pct = (n: number): string => `${n}%`;

/** Truncate a long hash for display. */
export const shortHash = (h: string | null | undefined): string => {
  if (!h) return "—";
  return h.length > 16 ? `${h.slice(0, 10)}…${h.slice(-4)}` : h;
};

/** Utilization band for color-coding bars/badges. */
export const utilBand = (p: number): "low" | "mid" | "high" =>
  p <= 40 ? "low" : p <= 70 ? "mid" : "high";
