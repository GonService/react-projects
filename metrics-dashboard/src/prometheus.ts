import { OVERVIEW_QUERIES, SERVICE_LABEL, SERVICE_QUERIES } from "./queries";
import { getRange, timeWindow } from "./ranges";
import type { Dashboard, OverviewKey, Point, RangeKey, Series, ServiceSeries } from "./types";

interface MatrixResponse {
  status: "success" | "error";
  error?: string;
  data?: { resultType: string; result: { metric: Record<string, string>; values: [number, string][] }[] };
}

export function queryRangeUrl(base: string, query: string, start: number, end: number, stepMs: number): string {
  const params = new URLSearchParams({
    query,
    start: String(start / 1000),
    end: String(end / 1000),
    step: `${Math.round(stepMs / 1000)}s`,
  });
  return `${base.replace(/\/$/, "")}/api/v1/query_range?${params}`;
}

/**
 * Turns a Prometheus matrix into series on a fixed time grid. Missing samples and NaN/Inf
 * values (e.g. a division by zero in an error-rate query) become null, which the charts draw as gaps.
 */
export function parseMatrix(body: MatrixResponse, grid: number[], label?: string): Series[] {
  if (body.status !== "success" || !body.data) throw new Error(body.error ?? "Prometheus returned an error");
  if (body.data.resultType !== "matrix") throw new Error(`Expected a matrix, got ${body.data.resultType}`);
  const results = label ? body.data.result.filter((r) => r.metric[label] !== undefined) : body.data.result;
  return results.map((r) => {
    const byTime = new Map(r.values.map(([ts, v]) => [Math.round(ts * 1000), Number(v)]));
    const points = grid.map((t): Point => {
      const v = byTime.get(t);
      return [t, v === undefined || !Number.isFinite(v) ? null : v];
    });
    return { name: (label ? r.metric[label] : undefined) ?? (Object.values(r.metric).join(",") || "value"), points };
  });
}

export async function loadPrometheus(base: string, rangeKey: RangeKey, now: number, fetchImpl: typeof fetch = (...a) => fetch(...a)): Promise<Dashboard> {
  const { start, end, step } = timeWindow(getRange(rangeKey), now);
  const grid: number[] = [];
  for (let t = start; t <= end; t += step) grid.push(t);

  const run = async (query: string, label?: string): Promise<Series[]> => {
    const res = await fetchImpl(queryRangeUrl(base, query, start, end, step), { headers: { Accept: "application/json" } });
    let body: MatrixResponse;
    try {
      body = (await res.json()) as MatrixResponse;
    } catch {
      throw new Error(`Prometheus answered ${res.status} without JSON`);
    }
    if (!res.ok && body.status !== "error") throw new Error(`Prometheus answered ${res.status}`);
    return parseMatrix(body, grid, label);
  };

  const empty = (name: string): Series => ({ name, points: grid.map((t): Point => [t, null]) });
  const overviewKeys = Object.keys(OVERVIEW_QUERIES) as OverviewKey[];
  const serviceKeys = Object.keys(SERVICE_QUERIES) as (keyof typeof SERVICE_QUERIES)[];

  const [overviewResults, serviceResults] = await Promise.all([
    Promise.all(overviewKeys.map((k) => run(OVERVIEW_QUERIES[k]))),
    Promise.all(serviceKeys.map((k) => run(SERVICE_QUERIES[k], SERVICE_LABEL))),
  ]);

  const overview = Object.fromEntries(overviewKeys.map((k, i) => [k, { ...(overviewResults[i]![0] ?? empty(k)), name: k }])) as Record<OverviewKey, Series>;

  const names = [...new Set(serviceResults.flat().map((s) => s.name))].sort();
  const services: ServiceSeries[] = names.map((name) => {
    const get = (i: number) => serviceResults[i]!.find((s) => s.name === name) ?? empty(name);
    return { name, rps: get(0), errorRate: get(1), p95: get(2), cpu: get(3) };
  });

  return { source: "prometheus", start, end, step, overview, services };
}
