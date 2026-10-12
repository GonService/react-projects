import type { Priority, SlaState, Status, Ticket } from "./types";

export const PRIORITIES: Priority[] = ["urgent", "high", "normal", "low"];
export const OPEN_STATUSES: Status[] = ["open", "in_progress", "waiting"];
export const AT_RISK_MS = 2 * 60 * 60 * 1000; // less than 2 hours left

export const PRIORITY_LABEL: Record<Priority, string> = { urgent: "Urgent", high: "High", normal: "Normal", low: "Low" };
export const STATUS_LABEL: Record<Status, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting: "Waiting for customer",
  resolved: "Resolved",
  closed: "Closed",
};

export function isOpen(t: Ticket): boolean {
  return OPEN_STATUSES.includes(t.status);
}

export function slaState(t: Ticket, now: number): SlaState {
  if (!isOpen(t)) return "done";
  const left = Date.parse(t.dueAt) - now;
  if (left < 0) return "overdue";
  if (left < AT_RISK_MS) return "at_risk";
  return "on_track";
}

/** "3 h 20 min left", "45 min late" */
export function timeLeftLabel(t: Ticket, now: number): string {
  const diff = Date.parse(t.dueAt) - now;
  const mins = Math.round(Math.abs(diff) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const text = h > 0 ? (m > 0 ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
  return diff < 0 ? `${text} late` : `${text} left`;
}

export interface Filters {
  query: string;
  priority: Priority | "all";
  view: "open" | "overdue" | "all";
  assignee: string | "all" | "unassigned";
}

export const DEFAULT_FILTERS: Filters = { query: "", priority: "all", view: "open", assignee: "all" };

export function applyFilters(tickets: Ticket[], f: Filters, now: number): Ticket[] {
  const q = f.query.trim().toLowerCase();
  return tickets.filter((t) => {
    if (f.view === "open" && !isOpen(t)) return false;
    if (f.view === "overdue" && slaState(t, now) !== "overdue") return false;
    if (f.priority !== "all" && t.priority !== f.priority) return false;
    if (f.assignee === "unassigned" && t.assignee !== null) return false;
    if (f.assignee !== "all" && f.assignee !== "unassigned" && t.assignee !== f.assignee) return false;
    if (q && !`${t.id} ${t.title} ${t.requesterName} ${t.requesterEmail} ${t.category}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

export type SortKey = "due" | "priority" | "created";

const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export function sortTickets(tickets: Ticket[], key: SortKey): Ticket[] {
  const copy = [...tickets];
  if (key === "due") copy.sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  if (key === "priority") copy.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || Date.parse(a.dueAt) - Date.parse(b.dueAt));
  if (key === "created") copy.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return copy;
}

export interface Summary {
  open: number;
  overdue: number;
  atRisk: number;
  unassigned: number;
}

export function summarize(tickets: Ticket[], now: number): Summary {
  const open = tickets.filter(isOpen);
  return {
    open: open.length,
    overdue: open.filter((t) => slaState(t, now) === "overdue").length,
    atRisk: open.filter((t) => slaState(t, now) === "at_risk").length,
    unassigned: open.filter((t) => t.assignee === null).length,
  };
}
