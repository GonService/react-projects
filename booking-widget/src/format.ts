import { parseISODate, toMinutes, fromMinutes } from "./slots";
import type { Customer } from "./types";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatPrice(cents: number): string {
  return brl.format(cents / 100);
}

export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

/** "terça-feira, 13 de outubro" */
export function formatLongDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
}

export function formatMonth(year: number, month: number): string {
  const label = new Date(year, month, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function endTime(start: string, durationMin: number): string {
  return fromMinutes(toMinutes(start) + durationMin);
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Brazilian phone mask while typing: (51) 3333-4444 for landlines and (51) 99876-5432 for
 * mobiles. Extra digits are dropped.
 */
export function maskPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  if (d.length <= 10) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}

/** Valid area code (11-99, no zero) and 8 digits for landlines or 9 starting with 9 for mobiles. */
export function isValidPhone(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 10 && d.length !== 11) return false;
  if (!/^[1-9][1-9]/.test(d)) return false;
  if (d.length === 11) return d[2] === "9";
  return /^[2-5]$/.test(d[2] ?? "");
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export type CustomerErrors = Partial<Record<keyof Customer, string>>;

export function validateCustomer(c: Customer): CustomerErrors {
  const errors: CustomerErrors = {};
  const name = c.name.trim();
  if (!name) errors.name = "Informe seu nome.";
  else if (name.split(/\s+/).length < 2) errors.name = "Informe nome e sobrenome.";
  if (!onlyDigits(c.phone)) errors.phone = "Informe um telefone para contato.";
  else if (!isValidPhone(c.phone)) errors.phone = "Telefone inválido. Use DDD + número, ex.: (51) 99876-5432.";
  if (!c.email.trim()) errors.email = "Informe seu e-mail.";
  else if (!isValidEmail(c.email)) errors.email = "E-mail inválido, ex.: nome@exemplo.com.br.";
  if (c.notes.length > 300) errors.notes = "Use no máximo 300 caracteres.";
  return errors;
}

function icsStamp(date: string, time: string): string {
  return `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;
}

function icsEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/[,;]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
}

/** A minimal iCalendar file so the customer can add the appointment to their calendar. */
export function buildIcs(opts: {
  code: string;
  title: string;
  date: string;
  start: string;
  durationMin: number;
  location: string;
  timezone?: string;
}): string {
  const tz = opts.timezone ?? "America/Sao_Paulo";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GonService//booking-widget//PT",
    "BEGIN:VEVENT",
    `UID:${opts.code}@booking-widget`,
    `DTSTART;TZID=${tz}:${icsStamp(opts.date, opts.start)}`,
    `DTEND;TZID=${tz}:${icsStamp(opts.date, endTime(opts.start, opts.durationMin))}`,
    `SUMMARY:${icsEscape(opts.title)}`,
    `LOCATION:${icsEscape(opts.location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
