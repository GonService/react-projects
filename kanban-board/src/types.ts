export type ColumnId = "backlog" | "doing" | "review" | "done";

export interface Column {
  id: ColumnId;
  title: string;
  /** Work-in-progress limit; the column header warns when it is exceeded. */
  wipLimit?: number;
}

export interface Label {
  id: string;
  name: string;
  /** CSS colour used for the chip. */
  color: string;
}

export interface Person {
  id: string;
  name: string;
}

export interface Card {
  id: string;
  title: string;
  description: string;
  column: ColumnId;
  labels: string[];
  assignee: string | null;
  /** Due date as "YYYY-MM-DD", or null. */
  due: string | null;
  createdAt: string;
}

export interface Board {
  version: 1;
  cards: Card[];
  nextId: number;
}

export interface Filters {
  text: string;
  label: string;
  assignee: string;
  overdueOnly: boolean;
}
