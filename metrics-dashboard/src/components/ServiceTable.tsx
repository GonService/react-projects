import { useState } from "react";
import { formatMs, formatNumber, formatPct, latest } from "../stats";
import { level, worst } from "../thresholds";
import type { Health, ServiceSeries } from "../types";
import { Sparkline } from "./Sparkline";

type SortKey = "status" | "name" | "rps" | "errorRate" | "p95" | "cpu";

interface Row {
  name: string;
  status: Health;
  rps: number | null;
  errorRate: number | null;
  p95: number | null;
  cpu: number | null;
  svc: ServiceSeries;
}

const RANK: Record<Health, number> = { critical: 3, degraded: 2, unknown: 1, healthy: 0 };

export function serviceRows(services: ServiceSeries[]): Row[] {
  return services.map((svc) => {
    const errorRate = latest(svc.errorRate.points);
    const p95 = latest(svc.p95.points);
    const cpu = latest(svc.cpu.points);
    const status = worst([level("errorRate", errorRate), level("p95", p95), level("cpu", cpu)]);
    return { name: svc.name, status, rps: latest(svc.rps.points), errorRate, p95, cpu, svc };
  });
}

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "name", label: "Service" },
  { key: "status", label: "Status" },
  { key: "rps", label: "Requests/s", numeric: true },
  { key: "errorRate", label: "Errors", numeric: true },
  { key: "p95", label: "p95", numeric: true },
  { key: "cpu", label: "CPU", numeric: true },
];

export function ServiceTable({ services }: { services: ServiceSeries[] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "status", dir: -1 });
  const rows = serviceRows(services).sort((a, b) => {
    const va = sort.key === "status" ? RANK[a.status] : a[sort.key];
    const vb = sort.key === "status" ? RANK[b.status] : b[sort.key];
    const cmp = typeof va === "string" && typeof vb === "string" ? va.localeCompare(vb) : ((va as number | null) ?? -1) - ((vb as number | null) ?? -1);
    return cmp * sort.dir || a.name.localeCompare(b.name);
  });

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === "name" ? 1 : -1 }));

  const cell = (metric: "errorRate" | "p95" | "cpu", v: number | null, text: string) => (
    <td className={`num lvl-${level(metric, v)}`}>{text}</td>
  );

  return (
    <div className="table-wrap">
      <table className="services">
        <caption>Service health</caption>
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th key={c.key} scope="col" className={c.numeric ? "num" : undefined} aria-sort={sort.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
                <button type="button" onClick={() => toggle(c.key)}>
                  {c.label}
                  <span className="sort" aria-hidden="true">{sort.key === c.key ? (sort.dir === 1 ? "↑" : "↓") : ""}</span>
                </button>
              </th>
            ))}
            <th scope="col" className="trend-col">Traffic trend</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} data-status={r.status}>
              <th scope="row" className="svc-name">{r.name}</th>
              <td><span className={`badge badge-${r.status}`}>{r.status}</span></td>
              <td className="num">{formatNumber(r.rps, r.rps !== null && r.rps < 10 ? 1 : 0)}</td>
              {cell("errorRate", r.errorRate, formatPct(r.errorRate))}
              {cell("p95", r.p95, formatMs(r.p95))}
              {cell("cpu", r.cpu, formatPct(r.cpu, 0))}
              <td className="trend-col">
                <Sparkline points={r.svc.rps.points} label={`${r.name} requests per second trend`} tone={r.status === "critical" ? "critical" : r.status === "degraded" ? "degraded" : "default"} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
