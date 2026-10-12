import type { BusinessConfig, Busy } from "./types";

/* Dates are handled as local "YYYY-MM-DD" strings and times as "HH:MM", which keeps the
   availability rules free of timezone surprises. */

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function fromMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function weekday(iso: string): number {
  return parseISODate(iso).getDay();
}

/** True when two half-open ranges [aStart, aEnd) and [bStart, bEnd) overlap. */
export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export interface SlotQuery {
  date: string;
  durationMin: number;
  config: Pick<BusinessConfig, "hours" | "stepMin" | "leadMin" | "closedDates">;
  busy: Busy[];
  now: Date;
}

/**
 * Start times on `date` where an appointment of `durationMin` fits inside an opening interval,
 * does not overlap an existing booking and respects the minimum notice.
 */
export function availableSlots({ date, durationMin, config, busy, now }: SlotQuery): string[] {
  if (config.closedDates.includes(date)) return [];
  const today = toISODate(now);
  if (date < today) return [];
  const earliest = date === today ? now.getHours() * 60 + now.getMinutes() + config.leadMin : -1;

  const blocked = busy
    .filter((b) => b.date === date)
    .map((b) => [toMinutes(b.start), toMinutes(b.start) + b.durationMin] as const);

  const slots: string[] = [];
  for (const interval of config.hours[weekday(date)] ?? []) {
    const open = toMinutes(interval.start);
    const close = toMinutes(interval.end);
    for (let start = open; start + durationMin <= close; start += config.stepMin) {
      if (start < earliest) continue;
      const end = start + durationMin;
      if (blocked.some(([bs, be]) => overlaps(start, end, bs, be))) continue;
      slots.push(fromMinutes(start));
    }
  }
  return slots;
}

/** Last date customers may book, counting from today. */
export function lastBookableDate(now: Date, maxDaysAhead: number): string {
  return addDays(toISODate(now), maxDaysAhead);
}

/** True when the date is inside the booking window and the business opens that day. */
export function isOpenDay(date: string, config: BusinessConfig, now: Date): boolean {
  const today = toISODate(now);
  if (date < today || date > lastBookableDate(now, config.maxDaysAhead)) return false;
  if (config.closedDates.includes(date)) return false;
  return (config.hours[weekday(date)] ?? []).length > 0;
}

/**
 * Weeks of the month as rows of ISO dates (Sunday first). Days outside the month are null,
 * so the grid always lines up.
 */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: first.getDay() }, () => null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(toISODate(new Date(year, month, day)));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Splits slots into morning, afternoon and evening for display. */
export function groupSlots(slots: string[]): { label: string; slots: string[] }[] {
  const groups = [
    { label: "Manhã", slots: slots.filter((s) => toMinutes(s) < 12 * 60) },
    { label: "Tarde", slots: slots.filter((s) => toMinutes(s) >= 12 * 60 && toMinutes(s) < 18 * 60) },
    { label: "Noite", slots: slots.filter((s) => toMinutes(s) >= 18 * 60) },
  ];
  return groups.filter((g) => g.slots.length > 0);
}
