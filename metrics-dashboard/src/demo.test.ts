import { describe, expect, it } from "vitest";
import { demoDashboard, DEMO_SERVICES } from "./demo";
import { latest, values } from "./stats";

const NOW = Date.UTC(2026, 9, 12, 17, 4, 20); // Monday 14:04 in Brasília

describe("demo data", () => {
  it("is deterministic and aligned to the step", () => {
    const a = demoDashboard("6h", NOW);
    const b = demoDashboard("6h", NOW);
    expect(a).toEqual(b);
    expect(a.end % a.step).toBe(0);
    expect(a.overview.rps.points).toHaveLength(180);
    expect(a.services.map((s) => s.name)).toEqual(DEMO_SERVICES.map((s) => s.name));
  });

  it("returns the same value for the same instant in different ranges", () => {
    const h1 = demoDashboard("1h", NOW).services[0]!.rps.points.at(-1)!;
    const h6 = demoDashboard("6h", NOW).services[0]!.rps.points.find(([t]) => t === h1[0]);
    expect(h6).toBeDefined();
    // 6 h averages a few sub-samples per step, so allow a small difference.
    expect(Math.abs(h6![1]! - h1[1]!) / h1[1]!).toBeLessThan(0.1);
  });

  it("shows the payments incident and the current search slowdown", () => {
    const d = demoDashboard("6h", NOW);
    const payments = d.services.find((s) => s.name === "payments")!;
    expect(Math.max(...values(payments.errorRate.points))).toBeGreaterThan(10);
    expect(latest(payments.errorRate.points)).toBeLessThan(1);
    const search = d.services.find((s) => s.name === "search")!;
    expect(latest(search.p95.points)).toBeGreaterThan(400);
  });

  it("keeps totals consistent with the services", () => {
    const d = demoDashboard("1h", NOW);
    const i = 10;
    const sum = d.services.reduce((acc, s) => acc + s.rps.points[i]![1]!, 0);
    expect(d.overview.rps.points[i]![1]).toBeCloseTo(sum);
    expect(d.overview.p50.points[i]![1]!).toBeLessThan(d.overview.p95.points[i]![1]!);
    expect(d.overview.p95.points[i]![1]!).toBeLessThan(d.overview.p99.points[i]![1]!);
  });
});
