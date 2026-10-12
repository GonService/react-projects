/** [timestamp in ms, value] — value is null where the source had no data. */
export type Point = [number, number | null];

export interface Series {
  name: string;
  points: Point[];
}

export type RangeKey = "1h" | "6h" | "24h" | "7d";

export interface RangeDef {
  key: RangeKey;
  label: string;
  durationMs: number;
  stepMs: number;
}

export type OverviewKey = "rps" | "errorRate" | "p50" | "p95" | "p99" | "cpu";

export interface ServiceSeries {
  name: string;
  rps: Series;
  errorRate: Series;
  p95: Series;
  cpu: Series;
}

export interface Dashboard {
  source: "demo" | "prometheus";
  start: number;
  end: number;
  step: number;
  overview: Record<OverviewKey, Series>;
  services: ServiceSeries[];
}

export type Health = "healthy" | "degraded" | "critical" | "unknown";
