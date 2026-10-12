import { change, latest, mean, values } from "../stats";
import type { Health, Series } from "../types";
import { Sparkline } from "./Sparkline";

interface Props {
  label: string;
  series: Series;
  format: (v: number | null) => string;
  health: Health;
  /** Whether a rise is bad news (errors, latency, CPU) or good news (traffic). */
  higherIsWorse: boolean;
}

const HEALTH_TEXT: Record<Health, string> = { healthy: "Within target", degraded: "Above target", critical: "Critical", unknown: "No data" };

export function KpiTile({ label, series, format, health, higherIsWorse }: Props) {
  const now = latest(series.points);
  const avg = mean(values(series.points));
  const delta = change(now, avg);
  const trend = delta === null || Math.abs(delta) < 0.02 ? "flat" : delta > 0 ? "up" : "down";
  const bad = trend !== "flat" && (trend === "up") === higherIsWorse;
  return (
    <section className={`kpi kpi-${health}`} aria-label={label}>
      <header>
        <h2>{label}</h2>
        <span className="health"><span className="dot" aria-hidden="true" />{HEALTH_TEXT[health]}</span>
      </header>
      <p className="kpi-value">{format(now)}</p>
      <p className={`kpi-delta ${trend}${bad ? " bad" : ""}`}>
        {delta === null ? "–" : `${trend === "up" ? "▲" : trend === "down" ? "▼" : "■"} ${Math.abs(delta * 100).toFixed(0)}%`}
        <span> vs range average ({format(avg)})</span>
      </p>
      <Sparkline points={series.points} width={220} height={36} label={`${label} trend`} tone={health === "critical" ? "critical" : health === "degraded" ? "degraded" : "default"} />
    </section>
  );
}
