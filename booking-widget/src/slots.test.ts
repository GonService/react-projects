import { describe, expect, it } from "vitest";
import { availableSlots, groupSlots, isOpenDay, monthGrid, overlaps } from "./slots";
import type { BusinessConfig } from "./types";

const config: BusinessConfig = {
  name: "Teste",
  address: "",
  hours: {
    0: [],
    1: [{ start: "08:00", end: "12:00" }, { start: "13:00", end: "18:00" }],
    2: [{ start: "08:00", end: "12:00" }, { start: "13:00", end: "18:00" }],
    3: [{ start: "08:00", end: "12:00" }],
    4: [],
    5: [],
    6: [],
  },
  stepMin: 30,
  leadMin: 120,
  maxDaysAhead: 30,
  closedDates: ["2026-10-14"],
};

// Monday 12 Oct 2026, 07:00 local time.
const now = new Date(2026, 9, 12, 7, 0);

describe("overlaps", () => {
  it("treats ranges as half-open", () => {
    expect(overlaps(60, 120, 120, 180)).toBe(false);
    expect(overlaps(60, 121, 120, 180)).toBe(true);
    expect(overlaps(100, 110, 90, 200)).toBe(true);
  });
});

describe("availableSlots", () => {
  it("fits the service inside each opening interval", () => {
    const slots = availableSlots({ date: "2026-10-13", durationMin: 60, config, busy: [], now });
    expect(slots[0]).toBe("08:00");
    expect(slots).toContain("11:00");
    expect(slots).not.toContain("11:30"); // would end 12:30, after the lunch break starts
    expect(slots).toContain("13:00");
    expect(slots.at(-1)).toBe("17:00");
    expect(slots).toHaveLength(7 + 9);
  });

  it("skips slots overlapping existing bookings", () => {
    const busy = [{ date: "2026-10-13", start: "09:00", durationMin: 50 }];
    const slots = availableSlots({ date: "2026-10-13", durationMin: 60, config, busy, now });
    expect(slots).toContain("08:00"); // 08:00-09:00 ends exactly when the booking starts
    expect(slots).not.toContain("08:30");
    expect(slots).not.toContain("09:00");
    expect(slots).not.toContain("09:30"); // booking ends 09:50
    expect(slots).toContain("10:00");
  });

  it("ignores bookings on other days", () => {
    const busy = [{ date: "2026-10-19", start: "09:00", durationMin: 60 }];
    expect(availableSlots({ date: "2026-10-13", durationMin: 60, config, busy, now })).toContain("09:00");
  });

  it("respects the minimum notice today", () => {
    const at10 = new Date(2026, 9, 12, 10, 10);
    const slots = availableSlots({ date: "2026-10-12", durationMin: 30, config, busy: [], now: at10 });
    // 10:10 + 2 h = 12:10, so the morning is gone and the afternoon starts at 13:00.
    expect(slots[0]).toBe("13:00");
  });

  it("returns nothing for closed dates, closed weekdays and past days", () => {
    expect(availableSlots({ date: "2026-10-14", durationMin: 30, config, busy: [], now })).toEqual([]);
    expect(availableSlots({ date: "2026-10-15", durationMin: 30, config, busy: [], now })).toEqual([]);
    expect(availableSlots({ date: "2026-10-11", durationMin: 30, config, busy: [], now })).toEqual([]);
  });

  it("returns nothing when the service is longer than any interval", () => {
    expect(availableSlots({ date: "2026-10-21", durationMin: 300, config, busy: [], now })).toEqual([]);
  });
});

describe("isOpenDay", () => {
  it("limits the booking window", () => {
    expect(isOpenDay("2026-10-13", config, now)).toBe(true);
    expect(isOpenDay("2026-10-18", config, now)).toBe(false); // Sunday
    expect(isOpenDay("2026-11-10", config, now)).toBe(true); // 29 days ahead
    expect(isOpenDay("2026-11-17", config, now)).toBe(false); // beyond 30 days
  });
});

describe("monthGrid", () => {
  it("starts on Sunday and pads to whole weeks", () => {
    const grid = monthGrid(2026, 9); // October 2026 starts on a Thursday
    expect(grid[0]).toEqual([null, null, null, null, "2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(grid.every((w) => w.length === 7)).toBe(true);
    expect(grid.flat().filter(Boolean)).toHaveLength(31);
  });
});

describe("groupSlots", () => {
  it("groups by period and drops empty groups", () => {
    expect(groupSlots(["08:00", "13:30", "18:00"]).map((g) => g.label)).toEqual(["Manhã", "Tarde", "Noite"]);
    expect(groupSlots(["09:00"]).map((g) => g.label)).toEqual(["Manhã"]);
  });
});
