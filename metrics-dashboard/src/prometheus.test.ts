import { describe, expect, it, vi } from "vitest";
import { loadPrometheus, parseMatrix, queryRangeUrl } from "./prometheus";

describe("queryRangeUrl", () => {
  it("builds the query_range URL in seconds", () => {
    const url = new URL(queryRangeUrl("https://prom.example.com/", "sum(rate(x[5m]))", 1_700_000_000_000, 1_700_003_600_000, 30_000));
    expect(url.pathname).toBe("/api/v1/query_range");
    expect(url.searchParams.get("query")).toBe("sum(rate(x[5m]))");
    expect(url.searchParams.get("start")).toBe("1700000000");
    expect(url.searchParams.get("end")).toBe("1700003600");
    expect(url.searchParams.get("step")).toBe("30s");
  });
});

describe("parseMatrix", () => {
  const grid = [1000, 2000, 3000];
  it("maps samples onto the grid with gaps for missing and NaN values", () => {
    const series = parseMatrix(
      { status: "success", data: { resultType: "matrix", result: [{ metric: { service: "api" }, values: [[1, "4.5"], [3, "NaN"]] }] } },
      grid,
      "service",
    );
    expect(series).toEqual([{ name: "api", points: [[1000, 4.5], [2000, null], [3000, null]] }]);
  });

  it("raises Prometheus errors", () => {
    expect(() => parseMatrix({ status: "error", error: "parse error at char 4" }, grid)).toThrow("parse error");
  });
});

describe("loadPrometheus", () => {
  it("runs every query and groups services by label", async () => {
    const now = Date.UTC(2026, 9, 12, 17, 0, 0);
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      const query = url.searchParams.get("query")!;
      const t = Number(url.searchParams.get("end"));
      const result = query.includes("service")
        ? [{ metric: { service: "checkout" }, values: [[t, "12"]] }, { metric: { service: "auth" }, values: [[t, "3"]] }]
        : [{ metric: {}, values: [[t, "42"]] }];
      return new Response(JSON.stringify({ status: "success", data: { resultType: "matrix", result } }));
    });
    const d = await loadPrometheus("https://prom.example.com", "1h", now, fetchImpl as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledTimes(10);
    expect(d.source).toBe("prometheus");
    expect(d.overview.rps.points.at(-1)).toEqual([d.end, 42]);
    expect(d.services.map((s) => s.name)).toEqual(["auth", "checkout"]);
    expect(d.services[1]!.p95.points.at(-1)![1]).toBe(12);
  });

  it("reports HTTP errors", async () => {
    const fetchImpl = vi.fn(async () => new Response("bad gateway", { status: 502 }));
    await expect(loadPrometheus("https://prom.example.com", "1h", Date.now(), fetchImpl as typeof fetch)).rejects.toThrow("502");
  });
});
