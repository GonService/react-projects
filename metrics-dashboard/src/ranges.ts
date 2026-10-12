import type { RangeDef, RangeKey } from "./types";

const MIN = 60_000;
const HOUR = 60 * MIN;

export const RANGES: RangeDef[] = [
  { key: "1h", label: "1 h", durationMs: HOUR, stepMs: 30_000 },
  { key: "6h", label: "6 h", durationMs: 6 * HOUR, stepMs: 2 * MIN },
  { key: "24h", label: "24 h", durationMs: 24 * HOUR, stepMs: 10 * MIN },
  { key: "7d", label: "7 d", durationMs: 7 * 24 * HOUR, stepMs: HOUR },
];

export function getRange(key: RangeKey): RangeDef {
  return RANGES.find((r) => r.key === key)!;
}

/** Aligns the window to the step so repeated loads return the same timestamps. */
export function timeWindow(range: RangeDef, now: number): { start: number; end: number; step: number } {
  const end = Math.floor(now / range.stepMs) * range.stepMs;
  return { start: end - range.durationMs + range.stepMs, end, step: range.stepMs };
}
