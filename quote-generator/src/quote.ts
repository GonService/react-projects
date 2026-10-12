import type { Draft, LineItem, Party, Quote, Totals } from "./types";

/* Money is kept in integer cents to avoid floating point drift; only quantities may be decimal. */

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const plain = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });

export function formatBRL(cents: number): string {
  // Intl uses a non-breaking space after "R$"; keep it so the symbol never wraps alone.
  return brl.format(cents / 100);
}

export function formatMoneyInput(cents: number): string {
  return plain.format(cents / 100);
}

export function formatQuantity(n: number): string {
  return qty.format(n);
}

/**
 * Parses what people type in Brazil: "1.234,56", "1234,5", "R$ 99", "1234.56". Returns cents,
 * or null when the text is not a number.
 */
export function parseMoney(text: string): number | null {
  const n = parseDecimal(text.replace(/R\$/i, ""));
  return n === null ? null : Math.round(n * 100);
}

/** Decimal parser accepting comma or dot as decimal separator and dots as thousands. */
export function parseDecimal(text: string): number | null {
  let t = text.trim().replace(/\s/g, "");
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  if (!/^-?\d*\.?\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function lineGross(item: LineItem): number {
  return Math.round(item.quantity * item.unitPrice);
}

export function lineTotal(item: LineItem): number {
  return Math.round(lineGross(item) * (1 - clamp(item.discountPct, 0, 100) / 100));
}

export function computeTotals(q: Pick<Quote, "items" | "globalDiscount" | "taxPct">): Totals {
  const gross = q.items.reduce((s, i) => s + lineGross(i), 0);
  const itemsTotal = q.items.reduce((s, i) => s + lineTotal(i), 0);
  const globalDiscount = clamp(q.globalDiscount, 0, itemsTotal);
  const taxBase = itemsTotal - globalDiscount;
  const tax = Math.round((taxBase * clamp(q.taxPct, 0, 100)) / 100);
  return { gross, lineDiscounts: gross - itemsTotal, itemsTotal, globalDiscount, taxBase, tax, total: taxBase + tax };
}

/* Dates */

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function formatDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString("pt-BR");
}

export function formatLongDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

export function validUntil(q: Pick<Quote, "issueDate" | "validityDays">): string {
  return addDays(q.issueDate, q.validityDays);
}

/* CPF / CNPJ */

const digits = (s: string) => s.replace(/\D/g, "");

export function maskDocument(value: string): string {
  const d = digits(value).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function checkDigit(nums: number[], weights: number[]): number {
  const sum = nums.reduce((s, n, i) => s + n * weights[i]!, 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function isValidCPF(value: string): boolean {
  const d = digits(value).split("").map(Number);
  if (d.length !== 11 || d.every((n) => n === d[0])) return false;
  const d1 = checkDigit(d.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = checkDigit(d.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d[9] === d1 && d[10] === d2;
}

export function isValidCNPJ(value: string): boolean {
  const d = digits(value).split("").map(Number);
  if (d.length !== 14 || d.every((n) => n === d[0])) return false;
  const d1 = checkDigit(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = checkDigit(d.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d[12] === d1 && d[13] === d2;
}

/** Empty is fine (optional field); otherwise it must be a valid CPF or CNPJ. */
export function documentError(value: string): string | null {
  const d = digits(value);
  if (!d) return null;
  if (d.length === 11) return isValidCPF(d) ? null : "CPF inválido.";
  if (d.length === 14) return isValidCNPJ(d) ? null : "CNPJ inválido.";
  return "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).";
}

/* Quote helpers */

let seq = 0;
export function newItemId(): string {
  seq += 1;
  return `i${Date.now().toString(36)}${seq}`;
}

export function emptyItem(): LineItem {
  return { id: newItemId(), description: "", unit: "un", quantity: 1, unitPrice: 0, discountPct: 0 };
}

export function quoteProblems(q: Quote): string[] {
  const problems: string[] = [];
  if (!q.client.name.trim()) problems.push("Informe o nome do cliente.");
  const docErr = documentError(q.client.document);
  if (docErr) problems.push(`Cliente: ${docErr}`);
  if (!q.items.some((i) => i.description.trim() && lineTotal(i) > 0)) problems.push("Inclua ao menos um item com descrição e valor.");
  return problems;
}

const isParty = (p: unknown): p is Party =>
  !!p && typeof p === "object" && ["name", "document", "contact", "email", "phone", "address"].every((k) => typeof (p as Record<string, unknown>)[k] === "string");

const isItem = (i: unknown): i is LineItem => {
  if (!i || typeof i !== "object") return false;
  const x = i as Record<string, unknown>;
  return typeof x.id === "string" && typeof x.description === "string" && typeof x.unit === "string" &&
    typeof x.quantity === "number" && Number.isInteger(x.unitPrice) && typeof x.discountPct === "number";
};

/** Validates data coming from storage or an imported JSON file. */
export function parseQuote(value: unknown): Quote | null {
  if (!value || typeof value !== "object") return null;
  const q = value as Record<string, unknown>;
  if (q.version !== 1 || typeof q.number !== "string" || typeof q.issueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(q.issueDate)) return null;
  if (typeof q.validityDays !== "number" || !isParty(q.issuer) || !isParty(q.client)) return null;
  if (!Array.isArray(q.items) || !q.items.every(isItem)) return null;
  if (!Number.isInteger(q.globalDiscount) || typeof q.taxPct !== "number" || typeof q.taxLabel !== "string") return null;
  if (typeof q.paymentTerms !== "string" || typeof q.notes !== "string") return null;
  return value as Quote;
}

export function exportJson(q: Quote): string {
  return JSON.stringify(q, null, 2);
}

/* Drafts in localStorage. Storage may be unavailable or full; callers get a boolean back. */

export const DRAFTS_KEY = "quote-generator:drafts:v1";

export function loadDrafts(storage: Storage | undefined): Draft[] {
  try {
    const raw = storage?.getItem(DRAFTS_KEY);
    if (!raw) return [];
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.filter((d): d is Draft => !!d && typeof d.id === "string" && typeof d.savedAt === "string" && parseQuote(d.quote) !== null);
  } catch {
    return [];
  }
}

export function storeDrafts(storage: Storage | undefined, drafts: Draft[]): boolean {
  try {
    if (!storage) return false;
    storage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
    return true;
  } catch {
    return false;
  }
}

/** Inserts or replaces the draft with the same quote number, newest first. */
export function upsertDraft(drafts: Draft[], quote: Quote, savedAt: string): Draft[] {
  const id = quote.number;
  return [{ id, savedAt, quote }, ...drafts.filter((d) => d.id !== id)];
}

export function safeStorage(): Storage | undefined {
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

export function nextNumber(issueDate: string, drafts: Draft[]): string {
  const year = issueDate.slice(0, 4);
  const used = drafts
    .map((d) => d.quote.number.match(new RegExp(`^ORC-${year}-(\\d+)$`))?.[1])
    .filter(Boolean)
    .map(Number);
  const n = Math.max(141, ...used) + 1;
  return `ORC-${year}-${String(n).padStart(4, "0")}`;
}
