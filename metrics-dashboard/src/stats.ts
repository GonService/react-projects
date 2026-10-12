import type { Point } from "./types";

export function values(points: Point[]): number[] {
  return points.map((p) => p[1]).filter((v): v is number => v !== null && Number.isFinite(v));
}

export function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

/** Average of the last `n` known values: a steadier "current" figure than the last sample. */
export function latest(points: Point[], n = 3): number | null {
  return mean(values(points).slice(-n));
}

export function extent(points: Point[]): [number, number] | null {
  const v = values(points);
  if (!v.length) return null;
  return [Math.min(...v), Math.max(...v)];
}

/** Relative change from `base` to `value`, as a fraction. */
export function change(value: number | null, base: number | null): number | null {
  if (value === null || base === null || base === 0) return null;
  return (value - base) / Math.abs(base);
}

/** Around five "nice" ticks (1, 2, 2.5, 5 × 10^n) covering [0, max]. */
export function niceTicks(max: number, count = 5): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const ticks: number[] = [];
  for (let t = 0; t <= max + step * 0.001; t += step) ticks.push(Number(t.toFixed(10)));
  if (ticks.at(-1)! < max) ticks.push(Number((ticks.at(-1)! + step).toFixed(10)));
  return ticks;
}

export interface Scale {
  x: (t: number) => number;
  y: (v: number) => number;
}

export function linearScale(d0: number, d1: number, r0: number, r1: number): (v: number) => number {
  const span = d1 - d0 || 1;
  return (v) => r0 + ((v - d0) / span) * (r1 - r0);
}

const fmt = (n: number) => (Math.round(n * 10) / 10).toString();

/** SVG path for a line; gaps (null values) break the line into separate segments. */
export function linePath(points: Point[], s: Scale): string {
  let d = "";
  let pen = false;
  for (const [t, v] of points) {
    if (v === null || !Number.isFinite(v)) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${fmt(s.x(t))},${fmt(s.y(v))}`;
    pen = true;
  }
  return d;
}

/** Closed area under each continuous segment, down to `baseline` (in pixels). */
export function areaPath(points: Point[], s: Scale, baseline: number): string {
  const segments: Point[][] = [];
  let current: Point[] = [];
  for (const p of points) {
    if (p[1] === null || !Number.isFinite(p[1])) {
      if (current.length) segments.push(current);
      current = [];
    } else current.push(p);
  }
  if (current.length) segments.push(current);
  return segments
    .map((seg) => {
      const first = seg[0]!;
      const last = seg.at(-1)!;
      return `${linePath(seg, s)}L${fmt(s.x(last[0]))},${fmt(baseline)}L${fmt(s.x(first[0]))},${fmt(baseline)}Z`;
    })
    .join("");
}

/** Index of the point closest in time to `t`. */
export function nearestIndex(points: Point[], t: number): number {
  let best = 0;
  for (let i = 1; i < points.length; i++) {
    if (Math.abs(points[i]![0] - t) < Math.abs(points[best]![0] - t)) best = i;
  }
  return best;
}

/* Formatting */

export function formatNumber(v: number | null, digits = 0): string {
  if (v === null) return "–";
  return v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatCompact(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}k`;
  return v.toLocaleString("en-US", { maximumFractionDigits: v < 10 ? 2 : 0 });
}

export function formatMs(v: number | null): string {
  if (v === null) return "–";
  return v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${Math.round(v)} ms`;
}

export function formatPct(v: number | null, digits = 2): string {
  return v === null ? "–" : `${v.toFixed(digits)}%`;
}

export function formatTime(t: number, rangeMs: number): string {
  const d = new Date(t);
  if (rangeMs > 24 * 3_600_000) return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(t: number): string {
  return new Date(t).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Time axis ticks at round intervals (5 min ... 1 day) for roughly `count` labels. */
export function timeTicks(start: number, end: number, count = 6): number[] {
  const steps = [5, 10, 15, 30, 60, 120, 180, 360, 720, 1440].map((m) => m * 60_000);
  const raw = (end - start) / count;
  const step = steps.find((s) => s >= raw) ?? 1440 * 60_000;
  // Align to local midnight-based multiples so labels read 10:00, 10:30...
  const offset = new Date(start).getTimezoneOffset() * 60_000;
  const first = Math.ceil((start - offset) / step) * step + offset;
  const ticks: number[] = [];
  for (let t = first; t <= end; t += step) ticks.push(t);
  return ticks;
}
