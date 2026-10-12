import { getRange, timeWindow } from "./ranges";
import type { Dashboard, OverviewKey, Point, RangeKey, Series, ServiceSeries } from "./types";

/* Deterministic demo data: every value is a function of (service, metric, timestamp), so the same
   instant always shows the same number in every range, and screenshots and tests are stable. */

interface Profile {
  name: string;
  rps: number;
  errorPct: number;
  p95: number;
  cpu: number;
}

export const DEMO_SERVICES: Profile[] = [
  { name: "api-gateway", rps: 410, errorPct: 0.25, p95: 120, cpu: 38 },
  { name: "checkout", rps: 62, errorPct: 0.4, p95: 260, cpu: 44 },
  { name: "catalog", rps: 240, errorPct: 0.1, p95: 85, cpu: 31 },
  { name: "payments", rps: 38, errorPct: 0.3, p95: 310, cpu: 41 },
  { name: "search", rps: 95, errorPct: 0.2, p95: 180, cpu: 52 },
  { name: "auth", rps: 130, errorPct: 0.05, p95: 60, cpu: 22 },
  { name: "notifications", rps: 24, errorPct: 0.6, p95: 140, cpu: 18 },
];

function hash(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const ch of parts.join("|")) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth noise in [-1, 1]: interpolates hashed values every 10 minutes. */
function noise(key: string, t: number, periodMs = 600_000): number {
  const i = Math.floor(t / periodMs);
  const f = (t % periodMs) / periodMs;
  const a = hash(key, i) * 2 - 1;
  const b = hash(key, i + 1) * 2 - 1;
  const s = f * f * (3 - 2 * f);
  return a + (b - a) * s;
}

/** Traffic follows the business day in Brasília (UTC-3): low at 4 am, peak mid-afternoon. */
function daily(t: number): number {
  const hour = (((t / 3_600_000 - 3) % 24) + 24) % 24;
  const weekday = new Date(t - 3 * 3_600_000).getUTCDay();
  const weekend = weekday === 0 || weekday === 6 ? 0.7 : 1;
  return (0.62 + 0.38 * Math.sin(((hour - 9) / 24) * 2 * Math.PI)) * weekend;
}

export interface Incident {
  service: string;
  from: number;
  to: number;
  kind: "errors" | "latency";
}

/** Two incidents anchored to "now": a payments outage 95–70 minutes ago and search slowing down in the last 25 minutes. */
export function demoIncidents(now: number): Incident[] {
  return [
    { service: "payments", from: now - 95 * 60_000, to: now - 70 * 60_000, kind: "errors" },
    { service: "search", from: now - 25 * 60_000, to: now + 60 * 60_000, kind: "latency" },
  ];
}

function intensity(incidents: Incident[], service: string, kind: Incident["kind"], t: number): number {
  for (const i of incidents) {
    if (i.service !== service || i.kind !== kind || t < i.from || t > i.to) continue;
    const ramp = Math.min(1, (t - i.from) / 300_000, (i.to - t) / 300_000);
    return Math.max(0, ramp);
  }
  return 0;
}

export function sampleService(p: Profile, t: number, incidents: Incident[]) {
  const load = daily(t) * (1 + 0.08 * noise(`${p.name}:rps`, t));
  const rps = p.rps * load;
  const err = intensity(incidents, p.name, "errors", t);
  const lat = intensity(incidents, p.name, "latency", t);
  const errorRate = Math.max(0, p.errorPct * (1 + 0.5 * noise(`${p.name}:err`, t, 300_000))) + err * 30;
  const p95 = p.p95 * (0.85 + 0.25 * load) * (1 + 0.1 * noise(`${p.name}:lat`, t, 300_000)) * (1 + err * 2.5 + lat * 2.4);
  const cpu = Math.min(99, p.cpu * (0.6 + 0.6 * load) * (1 + 0.06 * noise(`${p.name}:cpu`, t)) + lat * 18 + err * 8);
  return { rps, errorRate, p95, cpu };
}

function series(name: string, times: number[], f: (t: number) => number): Series {
  return { name, points: times.map((t): Point => [t, f(t)]) };
}

export function demoDashboard(rangeKey: RangeKey, now: number): Dashboard {
  const { start, end, step } = timeWindow(getRange(rangeKey), now);
  const times: number[] = [];
  for (let t = start; t <= end; t += step) times.push(t);
  const incidents = demoIncidents(now);
  // Wide ranges show step averages, like a rate()[step] query would, so short spikes soften.
  const sub = Math.max(1, Math.min(6, Math.round(step / 120_000)));
  const at = (p: Profile, t: number) => {
    const acc = { rps: 0, errorRate: 0, p95: 0, cpu: 0 };
    for (let i = 0; i < sub; i++) {
      const s = sampleService(p, t - (i * step) / sub, incidents);
      acc.rps += s.rps / sub;
      acc.errorRate += s.errorRate / sub;
      acc.p95 += s.p95 / sub;
      acc.cpu += s.cpu / sub;
    }
    return acc;
  };

  const services: ServiceSeries[] = DEMO_SERVICES.map((p) => {
    const samples = new Map(times.map((t) => [t, at(p, t)]));
    const pick = (k: "rps" | "errorRate" | "p95" | "cpu") => series(p.name, times, (t) => samples.get(t)![k]);
    return { name: p.name, rps: pick("rps"), errorRate: pick("errorRate"), p95: pick("p95"), cpu: pick("cpu") };
  });

  const sumAt = (k: "rps", i: number) => services.reduce((s, svc) => s + (svc[k].points[i]![1] ?? 0), 0);
  const weighted = (k: "errorRate" | "p95" | "cpu", i: number) => {
    const total = sumAt("rps", i);
    return services.reduce((s, svc) => s + (svc[k].points[i]![1] ?? 0) * (svc.rps.points[i]![1] ?? 0), 0) / total;
  };

  const idx = (name: string, f: (i: number) => number): Series => ({ name, points: times.map((t, i): Point => [t, f(i)]) });
  const p95 = idx("p95", (i) => weighted("p95", i));
  const overview: Record<OverviewKey, Series> = {
    rps: idx("requests/s", (i) => sumAt("rps", i)),
    errorRate: idx("error rate", (i) => weighted("errorRate", i)),
    p50: idx("p50", (i) => p95.points[i]![1]! * 0.42),
    p95,
    p99: idx("p99", (i) => p95.points[i]![1]! * (1.9 + 0.2 * noise("p99", times[i]!))),
    cpu: idx("CPU", (i) => services.reduce((s, svc) => s + (svc.cpu.points[i]![1] ?? 0), 0) / services.length),
  };
  return { source: "demo", start, end, step, overview, services };
}
