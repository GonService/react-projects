import { useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";
import type { Column } from "../types";
import { Plus } from "./Icons";

interface Props {
  column: Column;
  /** Cards in the column before filtering (for the WIP limit). */
  total: number;
  shown: number;
  filtered: boolean;
  onAdd: () => void;
  children: ReactNode;
}

export function ColumnView({ column, total, shown, filtered, onAdd, children }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${column.id}` });
  const over = column.wipLimit !== undefined && total > column.wipLimit;
  const headingId = `col-${column.id}`;
  return (
    <section className={`column${isOver ? " is-over" : ""}`} data-column={column.id} aria-labelledby={headingId}>
      <header className="column-head">
        <h2 id={headingId}>{column.title}</h2>
        <span className={`count${over ? " over" : ""}`} title={column.wipLimit ? `Limite de ${column.wipLimit} tarefas em andamento` : undefined}>
          {filtered ? `${shown} de ${total}` : total}
          {column.wipLimit !== undefined && <span className="wip"> / {column.wipLimit}</span>}
          {over && <span className="sr-only"> (acima do limite)</span>}
        </span>
      </header>
      <div ref={setNodeRef} className="column-body">
        {children}
        {shown === 0 && <p className="column-empty">{filtered ? "Nenhuma tarefa com esses filtros." : "Arraste tarefas para cá."}</p>}
      </div>
      <button type="button" className="add" onClick={onAdd}>
        <Plus /> Adicionar tarefa
      </button>
    </section>
  );
}
