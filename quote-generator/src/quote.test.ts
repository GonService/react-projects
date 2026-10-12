import { describe, expect, it } from "vitest";
import { demoQuote } from "./data";
import {
  computeTotals,
  documentError,
  formatBRL,
  isValidCNPJ,
  isValidCPF,
  lineTotal,
  loadDrafts,
  maskDocument,
  nextNumber,
  parseDecimal,
  parseMoney,
  parseQuote,
  quoteProblems,
  storeDrafts,
  upsertDraft,
  validUntil,
} from "./quote";

// Intl puts a non-breaking space between "R$" and the number.
const norm = (s: string) => s.replace(/ /g, " ");

describe("money parsing and formatting", () => {
  it("parses Brazilian and plain notations into cents", () => {
    expect(parseMoney("1.234,56")).toBe(123456);
    expect(parseMoney("R$ 99")).toBe(9900);
    expect(parseMoney("1234,5")).toBe(123450);
    expect(parseMoney("1234.56")).toBe(123456);
    expect(parseMoney("1.500")).toBe(150000);
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("")).toBeNull();
  });

  it("parses decimal quantities", () => {
    expect(parseDecimal("2,5")).toBe(2.5);
    expect(parseDecimal("0,125")).toBe(0.125);
    expect(parseDecimal("1,2,3")).toBeNull();
  });

  it("formats in reais", () => {
    expect(norm(formatBRL(1298531))).toBe("R$ 12.985,31");
    expect(norm(formatBRL(5))).toBe("R$ 0,05");
  });
});

describe("totals", () => {
  it("applies line discounts, the global discount and taxes", () => {
    const t = computeTotals(demoQuote("2026-10-12"));
    expect(t.gross).toBe(1_335_500);
    expect(t.lineDiscounts).toBe(54_790);
    expect(t.itemsTotal).toBe(1_280_710);
    expect(t.globalDiscount).toBe(20_000);
    expect(t.tax).toBe(37_821); // 3% of 12.607,10, rounded to the cent
    expect(t.total).toBe(1_298_531);
  });

  it("rounds fractional quantities to the cent", () => {
    expect(lineTotal({ id: "x", description: "", unit: "h", quantity: 1.333, unitPrice: 10_000, discountPct: 0 })).toBe(13_330);
    expect(lineTotal({ id: "x", description: "", unit: "un", quantity: 3, unitPrice: 333, discountPct: 33.3 })).toBe(666);
  });

  it("never lets the discount make the total negative", () => {
    const t = computeTotals({ items: [{ id: "a", description: "x", unit: "un", quantity: 1, unitPrice: 1000, discountPct: 0 }], globalDiscount: 5000, taxPct: 10 });
    expect(t.globalDiscount).toBe(1000);
    expect(t.total).toBe(0);
  });
});

describe("CPF and CNPJ", () => {
  it("masks while typing", () => {
    expect(maskDocument("529982247")).toBe("529.982.247");
    expect(maskDocument("52998224725")).toBe("529.982.247-25");
    expect(maskDocument("11444777000161")).toBe("11.444.777/0001-61");
  });

  it("checks the verification digits", () => {
    expect(isValidCPF("529.982.247-25")).toBe(true);
    expect(isValidCPF("529.982.247-24")).toBe(false);
    expect(isValidCPF("111.111.111-11")).toBe(false);
    expect(isValidCNPJ("11.444.777/0001-61")).toBe(true);
    expect(isValidCNPJ("11.444.777/0001-62")).toBe(false);
    expect(isValidCNPJ(demoQuote("2026-10-12").client.document)).toBe(true);
  });

  it("explains what is wrong", () => {
    expect(documentError("")).toBeNull();
    expect(documentError("123")).toMatch(/11 dígitos/);
    expect(documentError("529.982.247-24")).toBe("CPF inválido.");
  });
});

describe("quote rules", () => {
  it("computes the validity date", () => {
    expect(validUntil({ issueDate: "2026-12-20", validityDays: 15 })).toBe("2027-01-04");
  });

  it("lists what blocks printing", () => {
    const q = demoQuote("2026-10-12");
    expect(quoteProblems(q)).toEqual([]);
    expect(quoteProblems({ ...q, client: { ...q.client, name: "" }, items: [] })).toEqual([
      "Informe o nome do cliente.",
      "Inclua ao menos um item com descrição e valor.",
    ]);
  });

  it("validates imported JSON", () => {
    const q = demoQuote("2026-10-12");
    expect(parseQuote(JSON.parse(JSON.stringify(q)))).toEqual(q);
    expect(parseQuote({ ...q, items: [{ description: 1 }] })).toBeNull();
    expect(parseQuote({ ...q, globalDiscount: 1.5 })).toBeNull();
    expect(parseQuote("nope")).toBeNull();
  });
});

describe("drafts", () => {
  it("replaces drafts with the same number and keeps newest first", () => {
    const q = demoQuote("2026-10-12");
    let drafts = upsertDraft([], q, "2026-10-12T10:00:00Z");
    drafts = upsertDraft(drafts, { ...q, number: "ORC-2026-0150" }, "2026-10-12T11:00:00Z");
    drafts = upsertDraft(drafts, { ...q, notes: "v2" }, "2026-10-12T12:00:00Z");
    expect(drafts.map((d) => d.id)).toEqual(["ORC-2026-0142", "ORC-2026-0150"]);
    expect(drafts[0]!.quote.notes).toBe("v2");
    expect(nextNumber("2026-10-12", drafts)).toBe("ORC-2026-0151");
  });

  it("survives broken storage", () => {
    const broken = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("quota"); } } as unknown as Storage;
    expect(loadDrafts(broken)).toEqual([]);
    expect(storeDrafts(broken, [])).toBe(false);
    localStorage.setItem("quote-generator:drafts:v1", "[{\"id\":1}]");
    expect(loadDrafts(localStorage)).toEqual([]);
  });
});
