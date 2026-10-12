import { describe, expect, it, vi } from "vitest";
import { business } from "./config";
import { availableSlots } from "./slots";
import { createDemoApi, createHttpApi, demoBusyFor, SlotTakenError } from "./api";

describe("demo api", () => {
  it("produces the same busy times for the same date", () => {
    expect(demoBusyFor("2026-10-13")).toEqual(demoBusyFor("2026-10-13"));
    expect(demoBusyFor("2026-10-18")).toEqual([]); // Sunday, closed
  });

  it("books a free slot and refuses it the second time", async () => {
    const api = createDemoApi(0);
    const date = "2026-10-13";
    const free = availableSlots({ date, durationMin: 40, config: business, busy: demoBusyFor(date), now: new Date(2026, 9, 12, 8, 0) });
    expect(free.length).toBeGreaterThan(0);
    const req = { serviceId: "acupuntura", date, start: free[0]!, customer: { name: "Ana Souza", phone: "(51) 99876-5432", email: "ana@exemplo.com.br", notes: "" } };
    const confirmation = await api.book(req);
    expect(confirmation.code).toMatch(/^MOV-[A-Z2-9]{6}$/);
    await expect(api.book(req)).rejects.toBeInstanceOf(SlotTakenError);
  });
});

describe("http api", () => {
  it("calls the REST endpoints and maps 409 to SlotTakenError", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      if (String(url).endsWith("/bookings")) return new Response("{}", { status: 409 });
      return new Response(JSON.stringify([]), { status: 200 });
    });
    const api = createHttpApi("https://agenda.exemplo.com.br/api/", fetchImpl as typeof fetch);
    await api.listBusy("2026-10-13", "2026-10-20");
    expect(fetchImpl).toHaveBeenCalledWith("https://agenda.exemplo.com.br/api/availability?from=2026-10-13&to=2026-10-20", expect.anything());
    await expect(api.book({ serviceId: "x", date: "2026-10-13", start: "09:00", customer: { name: "", phone: "", email: "", notes: "" } })).rejects.toBeInstanceOf(SlotTakenError);
  });
});
