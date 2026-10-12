import { describe, expect, it } from "vitest";
import { demoTickets } from "./data";
import { DEFAULT_FILTERS, applyFilters, slaState, sortTickets, summarize, timeLeftLabel } from "./logic";
import type { Ticket } from "./types";

const NOW = Date.parse("2026-10-12T15:00:00Z");
const HOUR = 3600_000;

function ticket(over: Partial<Ticket>): Ticket {
  return {
    id: 1,
    title: "Printer offline",
    requesterName: "Ana",
    requesterEmail: "ana@example.com",
    category: "IT",
    priority: "normal",
    status: "open",
    assignee: null,
    createdAt: new Date(NOW - HOUR).toISOString(),
    dueAt: new Date(NOW + 10 * HOUR).toISOString(),
    ...over,
  };
}

describe("SLA state", () => {
  it("classifies late, at risk, on track and done", () => {
    expect(slaState(ticket({ dueAt: new Date(NOW - 1).toISOString() }), NOW)).toBe("overdue");
    expect(slaState(ticket({ dueAt: new Date(NOW + HOUR).toISOString() }), NOW)).toBe("at_risk");
    expect(slaState(ticket({}), NOW)).toBe("on_track");
    expect(slaState(ticket({ status: "resolved", dueAt: new Date(NOW - HOUR).toISOString() }), NOW)).toBe("done");
  });

  it("formats time left and time late", () => {
    expect(timeLeftLabel(ticket({ dueAt: new Date(NOW + 3 * HOUR + 20 * 60_000).toISOString() }), NOW)).toBe("3 h 20 min left");
    expect(timeLeftLabel(ticket({ dueAt: new Date(NOW - 45 * 60_000).toISOString() }), NOW)).toBe("45 min late");
    expect(timeLeftLabel(ticket({ dueAt: new Date(NOW + 2 * HOUR).toISOString() }), NOW)).toBe("2 h left");
  });
});

describe("filters and sorting", () => {
  const list = [
    ticket({ id: 1, priority: "low", dueAt: new Date(NOW + 50 * HOUR).toISOString() }),
    ticket({ id: 2, priority: "urgent", title: "Checkout down", assignee: "marina", dueAt: new Date(NOW - HOUR).toISOString() }),
    ticket({ id: 3, status: "closed" }),
  ];

  it("shows open tickets by default", () => {
    expect(applyFilters(list, DEFAULT_FILTERS, NOW).map((t) => t.id)).toEqual([1, 2]);
  });

  it("filters late, priority, assignee and text", () => {
    expect(applyFilters(list, { ...DEFAULT_FILTERS, view: "overdue" }, NOW).map((t) => t.id)).toEqual([2]);
    expect(applyFilters(list, { ...DEFAULT_FILTERS, view: "all", priority: "normal" }, NOW).map((t) => t.id)).toEqual([3]);
    expect(applyFilters(list, { ...DEFAULT_FILTERS, assignee: "unassigned" }, NOW).map((t) => t.id)).toEqual([1]);
    expect(applyFilters(list, { ...DEFAULT_FILTERS, query: "checkout" }, NOW).map((t) => t.id)).toEqual([2]);
  });

  it("sorts by deadline and by priority", () => {
    expect(sortTickets(list, "due").map((t) => t.id)).toEqual([2, 3, 1]);
    expect(sortTickets(list, "priority").map((t) => t.id)[0]).toBe(2);
  });

  it("summarizes the queue", () => {
    expect(summarize(list, NOW)).toEqual({ open: 2, overdue: 1, atRisk: 0, unassigned: 1 });
  });
});

describe("demo data", () => {
  it("always contains late, at-risk and closed tickets", () => {
    const s = summarize(demoTickets(NOW), NOW);
    expect(s.overdue).toBeGreaterThan(0);
    expect(s.atRisk).toBeGreaterThan(0);
    expect(s.open).toBeLessThan(demoTickets(NOW).length);
  });
});
