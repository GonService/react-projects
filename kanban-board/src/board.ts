import type { Board, Card, ColumnId, Filters } from "./types";
import { columns } from "./data";

const COLUMN_ORDER: ColumnId[] = columns.map((c) => c.id);

export function cardsIn(cards: Card[], column: ColumnId): Card[] {
  return cards.filter((c) => c.column === column);
}

/**
 * Moves a card to `toColumn` at position `toIndex` (counted among the cards of that column,
 * without the moved card). Indexes past the end append. Returns a new array.
 */
export function moveCard(cards: Card[], id: string, toColumn: ColumnId, toIndex: number): Card[] {
  const card = cards.find((c) => c.id === id);
  if (!card) return cards;
  const rest = cards.filter((c) => c.id !== id);
  const target = cardsIn(rest, toColumn);
  const moved = { ...card, column: toColumn };
  const index = Math.max(0, Math.min(toIndex, target.length));
  if (index === target.length) {
    const last = target.at(-1);
    const at = last ? rest.indexOf(last) + 1 : rest.length;
    return [...rest.slice(0, at), moved, ...rest.slice(at)];
  }
  const before = rest.indexOf(target[index]!);
  return [...rest.slice(0, before), moved, ...rest.slice(before)];
}

/** Moves a card to the previous (-1) or next (+1) column, keeping it at the top. */
export function moveToAdjacentColumn(cards: Card[], id: string, delta: -1 | 1): Card[] {
  const card = cards.find((c) => c.id === id);
  if (!card) return cards;
  const next = COLUMN_ORDER[COLUMN_ORDER.indexOf(card.column) + delta];
  if (!next) return cards;
  return moveCard(cards, id, next, 0);
}

/** Moves a card up (-1) or down (+1) inside its column. */
export function reorderInColumn(cards: Card[], id: string, delta: -1 | 1): Card[] {
  const card = cards.find((c) => c.id === id);
  if (!card) return cards;
  const index = cardsIn(cards, card.column).indexOf(card);
  const target = index + delta;
  if (target < 0 || target >= cardsIn(cards, card.column).length) return cards;
  return moveCard(cards, id, card.column, target);
}

export function canMove(cards: Card[], id: string, delta: -1 | 1): boolean {
  const card = cards.find((c) => c.id === id);
  return !!card && COLUMN_ORDER[COLUMN_ORDER.indexOf(card.column) + delta] !== undefined;
}

export type DueStatus = "overdue" | "today" | "soon" | "later";

/** Due date relative to today; done cards are never overdue. */
export function dueStatus(card: Pick<Card, "due" | "column">, today: string): DueStatus | null {
  if (!card.due) return null;
  if (card.column === "done") return "later";
  if (card.due < today) return "overdue";
  if (card.due === today) return "today";
  const days = (Date.parse(card.due) - Date.parse(today)) / 86_400_000;
  return days <= 2 ? "soon" : "later";
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function matchesFilters(card: Card, filters: Filters, today: string): boolean {
  if (filters.label && !card.labels.includes(filters.label)) return false;
  if (filters.assignee === "none" && card.assignee !== null) return false;
  if (filters.assignee && filters.assignee !== "none" && card.assignee !== filters.assignee) return false;
  if (filters.overdueOnly && dueStatus(card, today) !== "overdue") return false;
  const q = normalize(filters.text.trim());
  if (q && !normalize(`${card.id} ${card.title} ${card.description}`).includes(q)) return false;
  return true;
}

export const EMPTY_FILTERS: Filters = { text: "", label: "", assignee: "", overdueOnly: false };

export function hasFilters(f: Filters): boolean {
  return !!(f.text.trim() || f.label || f.assignee || f.overdueOnly);
}

/* Persistence. Storage can be missing, full or blocked (private mode, embedded iframes), so every
   access is guarded and the board keeps working in memory. */

export const STORAGE_KEY = "kanban-board:v1";

function isBoard(value: unknown): value is Board {
  if (!value || typeof value !== "object") return false;
  const b = value as Board;
  return b.version === 1 && Array.isArray(b.cards) && typeof b.nextId === "number" &&
    b.cards.every((c) => typeof c.id === "string" && typeof c.title === "string" && COLUMN_ORDER.includes(c.column) && Array.isArray(c.labels));
}

export function loadBoard(storage: Storage | undefined): Board | null {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isBoard(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Returns false when the board could not be saved. */
export function saveBoard(storage: Storage | undefined, board: Board): boolean {
  try {
    if (!storage) return false;
    storage.setItem(STORAGE_KEY, JSON.stringify(board));
    return true;
  } catch {
    return false;
  }
}

export function safeStorage(): Storage | undefined {
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "13 out" */
export function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
    .toLocaleDateString("pt-BR", { day: "numeric", month: "short" })
    .replace(".", "");
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)![0] : "")).toUpperCase();
}

/**
 * Applies a drag-and-drop result. `overId` is "col:<column>" (drop on the column: append) or
 * "card:<id>" (drop on a card: take its place, pushing it down). Returns the same array when
 * nothing changes.
 */
export function applyDrop(cards: Card[], activeId: string, overId: string): Card[] {
  if (!cards.some((c) => c.id === activeId)) return cards;
  if (overId.startsWith("col:")) {
    const column = overId.slice(4) as ColumnId;
    if (!COLUMN_ORDER.includes(column)) return cards;
    return moveCard(cards, activeId, column, Infinity);
  }
  const targetId = overId.slice(5);
  const target = cards.find((c) => c.id === targetId);
  if (!target || targetId === activeId) return cards;
  const index = cardsIn(cards.filter((c) => c.id !== activeId), target.column).findIndex((c) => c.id === targetId);
  return moveCard(cards, activeId, target.column, index);
}
