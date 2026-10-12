import type { Health } from "./types";

/** Service level targets used for colouring and for the threshold lines on the charts. */
export const THRESHOLDS = {
  errorRate: { warn: 1, crit: 5 }, // percent of requests answered with 5xx
  p95: { warn: 400, crit: 1000 }, // milliseconds
  cpu: { warn: 75, crit: 90 }, // percent
} as const;

type Metric = keyof typeof THRESHOLDS;

export function level(metric: Metric, value: number | null): Health {
  if (value === null || Number.isNaN(value)) return "unknown";
  const t = THRESHOLDS[metric];
  if (value >= t.crit) return "critical";
  if (value >= t.warn) return "degraded";
  return "healthy";
}

const ORDER: Health[] = ["healthy", "unknown", "degraded", "critical"];

/** The worst of several levels. Unknown only wins over healthy. */
export function worst(levels: Health[]): Health {
  return levels.reduce<Health>((acc, l) => (ORDER.indexOf(l) > ORDER.indexOf(acc) ? l : acc), "healthy");
}
