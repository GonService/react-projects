import { describe, expect, it } from "vitest";
import { buildIcs, formatDuration, formatPrice, isValidPhone, maskPhone, validateCustomer } from "./format";

describe("maskPhone", () => {
  it("formats while typing", () => {
    expect(maskPhone("5")).toBe("(5");
    expect(maskPhone("519")).toBe("(51) 9");
    expect(maskPhone("5133334444")).toBe("(51) 3333-4444");
    expect(maskPhone("51998765432")).toBe("(51) 99876-5432");
  });

  it("drops letters and extra digits", () => {
    expect(maskPhone("(51) 9 9876-5432 ramal 2")).toBe("(51) 99876-5432");
  });
});

describe("isValidPhone", () => {
  it("accepts mobiles and landlines with area code", () => {
    expect(isValidPhone("(51) 99876-5432")).toBe(true);
    expect(isValidPhone("(11) 3333-4444")).toBe(true);
  });

  it("rejects short numbers, bad area codes and mobiles without the 9", () => {
    expect(isValidPhone("99876-5432")).toBe(false);
    expect(isValidPhone("(01) 99876-5432")).toBe(false);
    expect(isValidPhone("(51) 89876-5432")).toBe(false);
  });
});

describe("validateCustomer", () => {
  it("reports every problem in Portuguese", () => {
    const errors = validateCustomer({ name: "Ana", phone: "(51) 9", email: "ana@", notes: "" });
    expect(errors.name).toMatch(/sobrenome/);
    expect(errors.phone).toMatch(/inválido/);
    expect(errors.email).toMatch(/inválido/);
  });

  it("passes valid data", () => {
    expect(validateCustomer({ name: "Ana Souza", phone: "(51) 99876-5432", email: "ana@exemplo.com.br", notes: "" })).toEqual({});
  });
});

describe("formatting", () => {
  it("formats prices and durations", () => {
    expect(formatPrice(18000)).toMatch(/R\$\s180,00/);
    expect(formatDuration(50)).toBe("50 min");
    expect(formatDuration(90)).toBe("1 h 30 min");
  });

  it("builds an iCalendar event with escaped text", () => {
    const ics = buildIcs({ code: "MOV-ABC", title: "Pilates, clínico", date: "2026-10-13", start: "09:30", durationMin: 50, location: "Rua X; 10" });
    expect(ics).toContain("DTSTART;TZID=America/Sao_Paulo:20261013T093000");
    expect(ics).toContain("DTEND;TZID=America/Sao_Paulo:20261013T102000");
    expect(ics).toContain("SUMMARY:Pilates\\, clínico");
    expect(ics).toContain("LOCATION:Rua X\\; 10");
  });
});
