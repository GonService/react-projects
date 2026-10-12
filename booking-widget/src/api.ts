import { business, services as demoServices } from "./config";
import { addDays, fromMinutes, overlaps, toMinutes, weekday } from "./slots";
import type { BookingRequest, Busy, Confirmation, Service } from "./types";

/** What the widget needs from a backend. */
export interface BookingApi {
  mode: "demo" | "api";
  listServices(): Promise<Service[]>;
  /** Existing appointments between two dates (inclusive). */
  listBusy(from: string, to: string): Promise<Busy[]>;
  book(request: BookingRequest): Promise<Confirmation>;
}

export class SlotTakenError extends Error {
  constructor() {
    super("Esse horário acabou de ser reservado por outra pessoa. Escolha outro horário.");
  }
}

/** Small deterministic generator so the demo calendar looks the same on every visit. */
function seeded(seed: string): () => number {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** Appointments already on the books for a date in demo mode (roughly half the day is taken). */
export function demoBusyFor(date: string): Busy[] {
  const rand = seeded(date);
  const busy: Busy[] = [];
  for (const interval of business.hours[weekday(date)] ?? []) {
    let start = toMinutes(interval.start);
    const close = toMinutes(interval.end);
    while (start + 50 <= close) {
      if (rand() < 0.45) {
        const durationMin = rand() < 0.5 ? 50 : 60;
        busy.push({ date, start: fromMinutes(start), durationMin });
        start += 60;
      } else {
        start += 30;
      }
    }
  }
  return busy;
}

function bookingCode(req: BookingRequest): string {
  const rand = seeded(`${req.date}${req.start}${req.customer.email}`);
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(rand() * alphabet.length)];
  return `MOV-${code}`;
}

export function createDemoApi(delayMs = 250): BookingApi {
  const created: Busy[] = [];
  const wait = () => new Promise((r) => setTimeout(r, delayMs));

  const busyBetween = (from: string, to: string): Busy[] => {
    const result: Busy[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) result.push(...demoBusyFor(d));
    return result.concat(created.filter((b) => b.date >= from && b.date <= to));
  };

  return {
    mode: "demo",
    async listServices() {
      await wait();
      return demoServices;
    },
    async listBusy(from, to) {
      await wait();
      return busyBetween(from, to);
    },
    async book(req) {
      await wait();
      const service = demoServices.find((s) => s.id === req.serviceId);
      if (!service) throw new Error("Serviço não encontrado.");
      const start = toMinutes(req.start);
      const clash = busyBetween(req.date, req.date).some((b) =>
        overlaps(start, start + service.durationMin, toMinutes(b.start), toMinutes(b.start) + b.durationMin),
      );
      if (clash) throw new SlotTakenError();
      created.push({ date: req.date, start: req.start, durationMin: service.durationMin });
      return { code: bookingCode(req), ...req };
    },
  };
}

/**
 * REST client. Expected endpoints:
 *   GET  {base}/services                      -> Service[]
 *   GET  {base}/availability?from=..&to=..    -> Busy[]
 *   POST {base}/bookings                      -> Confirmation (409 when the slot was taken)
 */
export function createHttpApi(base: string, fetchImpl: typeof fetch = (...args) => fetch(...args)): BookingApi {
  const root = base.replace(/\/$/, "");
  const call = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const res = await fetchImpl(`${root}${path}`, {
      ...init,
      headers: { Accept: "application/json", "Content-Type": "application/json" },
    });
    if (res.status === 409) throw new SlotTakenError();
    if (!res.ok) throw new Error(`Não foi possível falar com a agenda (erro ${res.status}). Tente novamente.`);
    return (await res.json()) as T;
  };
  return {
    mode: "api",
    listServices: () => call<Service[]>("/services"),
    listBusy: (from, to) => call<Busy[]>(`/availability?from=${from}&to=${to}`),
    book: (req) => call<Confirmation>("/bookings", { method: "POST", body: JSON.stringify(req) }),
  };
}

export function defaultApi(): BookingApi {
  const base = import.meta.env.VITE_API_URL as string | undefined;
  return base ? createHttpApi(base) : createDemoApi();
}
