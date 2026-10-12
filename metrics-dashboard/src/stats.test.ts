import { describe, expect, it } from "vitest";
import { areaPath, change, latest, linePath, linearScale, nearestIndex, niceTicks, formatMs, formatPct, formatCompact } from "./stats";
import { level, worst } from "./thresholds";
import type { Point } from "./types";

const s = { x: linearScale(0, 10, 0, 100), y: linearScale(0, 10, 100, 0) };

describe("paths", () => {
  it("draws a line through the points", () => {
    expect(linePath([[0, 0], [5, 5], [10, 10]], s)).toBe("M0,100L50,50L100,0");
  });

  it("breaks the line at gaps", () => {
    const pts: Point[] = [[0, 1], [2, 2], [4, null], [6, 3], [8, 4]];
    expect(linePath(pts, s)).toBe("M0,90L20,80M60,70L80,60");
  });

  it("closes one area per continuous segment", () => {
    const pts: Point[] = [[0, 1], [2, 2], [4, null], [6, 3]];
    expect(areaPath(pts, s, 100)).toBe("M0,90L20,80L20,100L0,100ZM60,70L60,100L60,100Z");
  });
});

describe("scales and ticks", () => {
  it("produces round ticks that cover the maximum", () => {
    expect(niceTicks(9.3, 4)).toEqual([0, 2.5, 5, 7.5, 10]);
    expect(niceTicks(1830, 4)).toEqual([0, 500, 1000, 1500, 2000]);
    expect(niceTicks(0)).toEqual([0, 1]);
  });

  it("finds the closest point in time", () => {
    const pts: Point[] = [[0, 1], [10, 1], [20, 1]];
    expect(nearestIndex(pts, 14)).toBe(1);
    expect(nearestIndex(pts, 16)).toBe(2);
    expect(nearestIndex(pts, -50)).toBe(0);
  });
});

describe("summaries", () => {
  it("averages the last known values and ignores gaps", () => {
    expect(latest([[0, 1], [1, 2], [2, 3], [3, null], [4, 7]])).toBe(4);
    expect(latest([[0, null]])).toBeNull();
  });

  it("computes relative change", () => {
    expect(change(110, 100)).toBeCloseTo(0.1);
    expect(change(5, 0)).toBeNull();
  });

  it("formats values", () => {
    expect(formatMs(412.4)).toBe("412 ms");
    expect(formatMs(1530)).toBe("1.53 s");
    expect(formatPct(0.4567)).toBe("0.46%");
    expect(formatCompact(1500)).toBe("1.5k");
  });
});

describe("thresholds", () => {
  it("classifies values and picks the worst", () => {
    expect(level("errorRate", 0.3)).toBe("healthy");
    expect(level("errorRate", 2)).toBe("degraded");
    expect(level("p95", 1200)).toBe("critical");
    expect(level("cpu", null)).toBe("unknown");
    expect(worst(["healthy", "unknown", "degraded"])).toBe("degraded");
    expect(worst(["healthy", "unknown"])).toBe("unknown");
  });
});
