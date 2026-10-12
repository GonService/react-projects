import { describe, expect, it } from "vitest";
import {
  applyDrop,
  cardsIn,
  dueStatus,
  EMPTY_FILTERS,
  loadBoard,
  matchesFilters,
  moveCard,
  moveToAdjacentColumn,
  reorderInColumn,
  saveBoard,
  STORAGE_KEY,
} from "./board";
import { demoBoard } from "./data";
import type { Card } from "./types";

const TODAY = "2026-10-12";
const card = (id: string, column: Card["column"], extra: Partial<Card> = {}): Card => ({
  id, title: id, description: "", column, labels: [], assignee: null, due: null, createdAt: TODAY, ...extra,
});
const ids = (cards: Card[], column: Card["column"]) => cardsIn(cards, column).map((c) => c.id);

const cards = [card("a", "backlog"), card("b", "backlog"), card("c", "doing"), card("d", "backlog")];

describe("moveCard", () => {
  it("inserts at a position inside the target column", () => {
    const next = moveCard(cards, "c", "backlog", 1);
    expect(ids(next, "backlog")).toEqual(["a", "c", "b", "d"]);
    expect(ids(next, "doing")).toEqual([]);
  });

  it("appends when the index is past the end", () => {
    expect(ids(moveCard(cards, "a", "backlog", 99), "backlog")).toEqual(["b", "d", "a"]);
    expect(ids(moveCard(cards, "a", "review", 99), "review")).toEqual(["a"]);
  });

  it("does not mutate the input", () => {
    const copy = structuredClone(cards);
    moveCard(cards, "a", "done", 0);
    expect(cards).toEqual(copy);
  });
});

describe("keyboard moves", () => {
  it("moves to the adjacent column, at the top", () => {
    const next = moveToAdjacentColumn(cards, "a", 1);
    expect(ids(next, "doing")).toEqual(["a", "c"]);
    expect(moveToAdjacentColumn(cards, "a", -1)).toBe(cards); // already in the first column
  });

  it("reorders inside the column and stops at the edges", () => {
    expect(ids(reorderInColumn(cards, "d", -1), "backlog")).toEqual(["a", "d", "b"]);
    expect(reorderInColumn(cards, "a", -1)).toBe(cards);
    expect(reorderInColumn(cards, "d", 1)).toBe(cards);
  });
});

describe("applyDrop", () => {
  it("drops on a column (append) or on a card (take its place)", () => {
    expect(ids(applyDrop(cards, "a", "col:doing"), "doing")).toEqual(["c", "a"]);
    expect(ids(applyDrop(cards, "c", "card:b"), "backlog")).toEqual(["a", "c", "b", "d"]);
    expect(ids(applyDrop(cards, "a", "card:d"), "backlog")).toEqual(["b", "a", "d"]);
  });

  it("ignores drops on itself or unknown targets", () => {
    expect(applyDrop(cards, "a", "card:a")).toBe(cards);
    expect(applyDrop(cards, "a", "col:nope")).toBe(cards);
    expect(applyDrop(cards, "zzz", "col:done")).toBe(cards);
  });
});

describe("dueStatus", () => {
  it("classifies due dates", () => {
    expect(dueStatus({ due: "2026-10-11", column: "doing" }, TODAY)).toBe("overdue");
    expect(dueStatus({ due: TODAY, column: "doing" }, TODAY)).toBe("today");
    expect(dueStatus({ due: "2026-10-14", column: "doing" }, TODAY)).toBe("soon");
    expect(dueStatus({ due: "2026-10-30", column: "doing" }, TODAY)).toBe("later");
    expect(dueStatus({ due: null, column: "doing" }, TODAY)).toBeNull();
  });

  it("never flags finished work as overdue", () => {
    expect(dueStatus({ due: "2026-10-01", column: "done" }, TODAY)).toBe("later");
  });
});

describe("matchesFilters", () => {
  const c = card("T-1", "doing", { title: "Integração Pix", labels: ["back"], assignee: "rafa", due: "2026-10-10" });
  it("searches ignoring accents and case", () => {
    expect(matchesFilters(c, { ...EMPTY_FILTERS, text: "integracao" }, TODAY)).toBe(true);
    expect(matchesFilters(c, { ...EMPTY_FILTERS, text: "t-1" }, TODAY)).toBe(true);
    expect(matchesFilters(c, { ...EMPTY_FILTERS, text: "boleto" }, TODAY)).toBe(false);
  });

  it("combines label, assignee and overdue filters", () => {
    expect(matchesFilters(c, { ...EMPTY_FILTERS, label: "back", assignee: "rafa", overdueOnly: true }, TODAY)).toBe(true);
    expect(matchesFilters(c, { ...EMPTY_FILTERS, label: "front" }, TODAY)).toBe(false);
    expect(matchesFilters(c, { ...EMPTY_FILTERS, assignee: "none" }, TODAY)).toBe(false);
  });
});

describe("persistence", () => {
  it("round-trips through storage", () => {
    const board = demoBoard(TODAY);
    saveBoard(localStorage, board);
    expect(loadBoard(localStorage)).toEqual(board);
  });

  it("ignores corrupt or foreign data", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(loadBoard(localStorage)).toBeNull();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, cards: [{ id: 1 }], nextId: 2 }));
    expect(loadBoard(localStorage)).toBeNull();
  });

  it("survives a storage that throws", () => {
    const broken = {
      getItem: () => { throw new Error("SecurityError"); },
      setItem: () => { throw new Error("QuotaExceededError"); },
    } as unknown as Storage;
    expect(loadBoard(broken)).toBeNull();
    expect(saveBoard(broken, demoBoard(TODAY))).toBe(false);
    expect(loadBoard(undefined)).toBeNull();
  });
});
