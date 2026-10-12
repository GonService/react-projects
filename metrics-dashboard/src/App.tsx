import { useCallback, useEffect, useState } from "react";
import { KpiTile } from "./components/KpiTile";
import { LineChart } from "./components/LineChart";
import { ServiceTable } from "./components/ServiceTable";
import { demoDashboard } from "./demo";
import { loadPrometheus } from "./prometheus";
import { getRange, RANGES } from "./ranges";
import { formatCompact, formatMs, formatNumber, formatPct, latest } from "./stats";
import { level, THRESHOLDS } from "./thresholds";
import type { Dashboard, RangeKey } from "./types";

export type Loader = (range: RangeKey, now: number) => Promise<Dashboard>;

interface Props {
  /** Fixed clock for tests and screenshots; disables auto refresh. */
  now?: number;
  loader?: Loader;
}

const PROMETHEUS_URL = import.meta.env.VITE_PROMETHEUS_URL as string | undefined;
const REFRESH_MS = 30_000;

export const demoLoader: Loader = async (range, now) => demoDashboard(range, now);

function defaultLoader(): Loader {
  return PROMETHEUS_URL ? (range, now) => loadPrometheus(PROMETHEUS_URL, range, now) : demoLoader;
}

function initialRange(): RangeKey {
  try {
    const r = new URLSearchParams(window.location.search).get("range");
    return RANGES.some((x) => x.key === r) ? (r as RangeKey) : "6h";
  } catch {
    return "6h";
  }
}

export default function App({ now: fixedNow, loader: loaderProp }: Props) {
  const [loader, setLoader] = useState<Loader>(() => loaderProp ?? defaultLoader());
  const [range, setRange] = useState<RangeKey>(initialRange);
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(fixedNow === undefined);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await loader(range, fixedNow ?? Date.now());
      setData(d);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [loader, range, fixedNow]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh || fixedNow !== undefined) return;
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(id);
  }, [autoRefresh, fixedNow, load]);

  const chooseRange = (key: RangeKey) => {
    setRange(key);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("range", key);
      window.history.replaceState(null, "", url);
    } catch {
      /* not important */
    }
  };

  const o = data?.overview;
  const rangeDef = getRange(range);

  return (
    <div className="app">
      <header className="top">
        <div className="title">
          <p className="env"><span className="env-dot" aria-hidden="true" />production · sa-east-1</p>
          <h1>Platform overview</h1>
        </div>
        <div className="controls">
          <div className="segmented" role="group" aria-label="Time range">
            {RANGES.map((r) => (
              <button key={r.key} type="button" aria-pressed={r.key === range} onClick={() => chooseRange(r.key)}>
                {r.label}
              </button>
            ))}
          </div>
          <label className="switch">
            <input type="checkbox" checked={autoRefresh} disabled={fixedNow !== undefined} onChange={(e) => setAutoRefresh(e.target.checked)} />
            <span>Auto refresh</span>
          </label>
          <button type="button" className="btn" onClick={() => void load()} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </header>

      <p className="meta" aria-live="polite">
        {data && (
          <>
            <span className={`source source-${data.source}`}>{data.source === "demo" ? "Demo data" : "Prometheus"}</span>
            Last {rangeDef.label} · {Math.round(rangeDef.stepMs / 1000) >= 60 ? `${rangeDef.stepMs / 60_000} min` : `${rangeDef.stepMs / 1000} s`} resolution · updated{" "}
            {new Date(data.end).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </>
        )}
      </p>

      {error && (
        <div className="alert" role="alert">
          <p><strong>Could not load metrics.</strong> {error}</p>
          <p className="alert-hint">Check VITE_PROMETHEUS_URL and that Prometheus allows this origin (CORS) or sits behind the same reverse proxy.</p>
          <div className="alert-actions">
            <button type="button" className="btn" onClick={() => void load()}>Try again</button>
            <button type="button" className="btn" onClick={() => setLoader(() => demoLoader)}>Show demo data</button>
          </div>
        </div>
      )}

      {!data && !error && <p className="loading" role="status">Loading metrics…</p>}

      {o && data && (
        <main>
          <div className="kpis">
            <KpiTile label="Requests/s" series={o.rps} format={(v) => formatNumber(v)} health={latest(o.rps.points) === null ? "unknown" : "healthy"} higherIsWorse={false} />
            <KpiTile label="Error rate" series={o.errorRate} format={(v) => formatPct(v)} health={level("errorRate", latest(o.errorRate.points))} higherIsWorse />
            <KpiTile label="p95 latency" series={o.p95} format={formatMs} health={level("p95", latest(o.p95.points))} higherIsWorse />
            <KpiTile label="CPU" series={o.cpu} format={(v) => formatPct(v, 0)} health={level("cpu", latest(o.cpu.points))} higherIsWorse />
          </div>

          <div className="charts">
            <LineChart
              title="Throughput"
              subtitle="Requests per second, all services"
              lines={[{ series: o.rps, label: "requests/s", color: "--c-traffic", area: true }]}
              format={(v) => `${formatNumber(v)} req/s`}
              tickFormat={formatCompact}
            />
            <LineChart
              title="Error rate"
              subtitle="Share of requests answered with 5xx"
              lines={[{ series: o.errorRate, label: "5xx", color: "--c-error", area: true }]}
              format={(v) => formatPct(v)}
              tickFormat={(v) => `${v}%`}
              threshold={{ value: THRESHOLDS.errorRate.warn, label: `SLO ${THRESHOLDS.errorRate.warn}%` }}
            />
            <LineChart
              title="Latency"
              subtitle="Request duration percentiles"
              lines={[
                { series: o.p50, label: "p50", color: "--c-p50" },
                { series: o.p95, label: "p95", color: "--c-p95" },
                { series: o.p99, label: "p99", color: "--c-p99" },
              ]}
              format={formatMs}
              tickFormat={(v) => (v >= 1000 ? `${v / 1000}s` : `${v}`)}
              threshold={{ value: THRESHOLDS.p95.warn, label: `p95 target ${THRESHOLDS.p95.warn} ms` }}
            />
            <LineChart
              title="CPU"
              subtitle="Average utilisation across nodes"
              lines={[{ series: o.cpu, label: "CPU", color: "--c-cpu", area: true }]}
              format={(v) => formatPct(v, 1)}
              tickFormat={(v) => `${v}%`}
              minMax={100}
              threshold={{ value: THRESHOLDS.cpu.warn, label: `${THRESHOLDS.cpu.warn}%` }}
            />
          </div>

          <ServiceTable services={data.services} />
        </main>
      )}

      <footer className="foot">
        Thresholds: errors ≥ {THRESHOLDS.errorRate.warn}% degraded, ≥ {THRESHOLDS.errorRate.crit}% critical · p95 ≥ {THRESHOLDS.p95.warn} ms / {THRESHOLDS.p95.crit} ms · CPU ≥ {THRESHOLDS.cpu.warn}% / {THRESHOLDS.cpu.crit}%
      </footer>
    </div>
  );
}
