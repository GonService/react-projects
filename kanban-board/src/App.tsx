import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  applyDrop,
  canMove,
  cardsIn,
  dueStatus,
  EMPTY_FILTERS,
  hasFilters,
  loadBoard,
  matchesFilters,
  moveCard,
  moveToAdjacentColumn,
  reorderInColumn,
  safeStorage,
  saveBoard,
  toISODate,
} from "./board";
import { CardDialog, type Draft } from "./components/CardDialog";
import { CardView } from "./components/CardView";
import { ColumnView } from "./components/ColumnView";
import { Plus, Search } from "./components/Icons";
import { columns, demoBoard, labels, people } from "./data";
import type { Board, Card, ColumnId, Filters } from "./types";

interface Props {
  /** Fixed clock for tests and screenshots. */
  now?: Date;
  /** Storage used to persist the board; null disables persistence. */
  storage?: Storage | null;
}

type Editing = { mode: "new"; column: ColumnId } | { mode: "edit"; id: string } | null;

const columnTitle = (id: ColumnId) => columns.find((c) => c.id === id)?.title ?? id;

export default function App({ now: nowProp, storage: storageProp }: Props) {
  const today = useMemo(() => toISODate(nowProp ?? new Date()), [nowProp]);
  const storage = storageProp === null ? undefined : (storageProp ?? safeStorage());
  const [board, setBoard] = useState<Board>(() => loadBoard(storage) ?? demoBoard(today));
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [editing, setEditing] = useState<Editing>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [saved, setSaved] = useState(true);
  const focusAfterMove = useRef<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSaved(storage ? saveBoard(storage, board) : false);
  }, [board, storage]);

  // Keep keyboard focus on a card after it moves to another column.
  useEffect(() => {
    const id = focusAfterMove.current;
    if (!id) return;
    focusAfterMove.current = null;
    document.querySelector<HTMLElement>(`[data-card-title="${id}"]`)?.focus();
  }, [board]);

  // "/" focuses search, "n" creates a task (when not typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (editing || e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "n") {
        e.preventDefault();
        setEditing({ mode: "new", column: "backlog" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing]);

  const setCards = (fn: (cards: Card[]) => Card[]) => setBoard((b) => ({ ...b, cards: fn(b.cards) }));
  const findCard = (id: string) => board.cards.find((c) => c.id === id);

  const moveBy = (id: string, delta: -1 | 1) => {
    const card = findCard(id);
    if (!card) return;
    const next = moveToAdjacentColumn(board.cards, id, delta);
    const moved = next.find((c) => c.id === id)!;
    if (moved.column === card.column) return;
    focusAfterMove.current = id;
    setCards(() => next);
    setAnnouncement(`${card.title} movida para ${columnTitle(moved.column)}.`);
  };

  const reorder = (id: string, delta: -1 | 1) => {
    const card = findCard(id);
    if (!card) return;
    const next = reorderInColumn(board.cards, id, delta);
    if (next === board.cards) return;
    focusAfterMove.current = id;
    setCards(() => next);
    const pos = cardsIn(next, card.column).findIndex((c) => c.id === id) + 1;
    setAnnouncement(`${card.title} agora é a ${pos}ª em ${columnTitle(card.column)}.`);
  };

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over) return;
    const id = String(active.id);
    const card = findCard(id);
    const next = applyDrop(board.cards, id, String(over.id));
    if (!card || next === board.cards) return;
    setCards(() => next);
    const column = next.find((c) => c.id === id)!.column;
    setAnnouncement(`${card.title} movida para ${columnTitle(column)}.`);
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Arrastando ${findCard(String(active.id))?.title ?? ""}.`,
    onDragOver: ({ over }) => (over ? `Sobre ${over.id.toString().startsWith("col:") ? columnTitle(over.id.toString().slice(4) as ColumnId) : findCard(over.id.toString().slice(5))?.title}.` : "Fora de uma coluna."),
    onDragEnd: () => "",
    onDragCancel: () => "Movimento cancelado.",
  };

  const save = (draft: Draft) => {
    if (!editing) return;
    if (editing.mode === "new") {
      const id = `T-${board.nextId}`;
      const card: Card = { id, ...draft, createdAt: today };
      setBoard((b) => ({ ...b, nextId: b.nextId + 1, cards: moveCard([...b.cards, card], id, draft.column, 0) }));
      setAnnouncement(`Tarefa ${id} criada em ${columnTitle(draft.column)}.`);
    } else {
      const old = findCard(editing.id);
      setCards((cards) => {
        const updated = cards.map((c) => (c.id === editing.id ? { ...c, ...draft } : c));
        return old && old.column !== draft.column ? moveCard(updated, editing.id, draft.column, 0) : updated;
      });
      setAnnouncement(`Tarefa ${editing.id} salva.`);
    }
    setEditing(null);
  };

  const remove = () => {
    if (editing?.mode !== "edit") return;
    const card = findCard(editing.id);
    setCards((cards) => cards.filter((c) => c.id !== editing.id));
    setEditing(null);
    setAnnouncement(`Tarefa ${card?.id} excluída.`);
    // The card no longer exists; put focus somewhere predictable.
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-column="${card?.column}"] .add`)?.focus());
  };

  const resetDemo = () => {
    if (!window.confirm("Substituir o quadro atual pelos dados de demonstração?")) return;
    setBoard(demoBoard(today));
    setFilters(EMPTY_FILTERS);
    setAnnouncement("Quadro de demonstração restaurado.");
  };

  const filtered = hasFilters(filters);
  const overdue = board.cards.filter((c) => dueStatus(c, today) === "overdue").length;
  const dueToday = board.cards.filter((c) => dueStatus(c, today) === "today").length;
  const active = activeId ? findCard(activeId) : null;
  const editingCard = editing?.mode === "edit" ? findCard(editing.id) : undefined;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <p className="eyebrow">Squad E-commerce · Sprint 42</p>
          <h1>Loja Serra Gaúcha</h1>
        </div>
        <dl className="stats" aria-label="Resumo do quadro">
          <div><dt>Tarefas</dt><dd>{board.cards.length}</dd></div>
          <div className={overdue ? "alert" : undefined}><dt>Atrasadas</dt><dd>{overdue}</dd></div>
          <div><dt>Vencem hoje</dt><dd>{dueToday}</dd></div>
        </dl>
        <button type="button" className="btn primary new" onClick={() => setEditing({ mode: "new", column: "backlog" })}>
          <Plus /> Nova tarefa
        </button>
      </header>

      <div className="toolbar" role="search">
        <label className="search">
          <Search />
          <span className="sr-only">Buscar tarefas</span>
          <input
            ref={searchRef}
            type="search"
            placeholder="Buscar por título, descrição ou código"
            value={filters.text}
            onChange={(e) => setFilters((f) => ({ ...f, text: e.target.value }))}
          />
        </label>
        <label className="select">
          <span>Etiqueta</span>
          <select value={filters.label} onChange={(e) => setFilters((f) => ({ ...f, label: e.target.value }))}>
            <option value="">Todas</option>
            {labels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <label className="select">
          <span>Responsável</span>
          <select value={filters.assignee} onChange={(e) => setFilters((f) => ({ ...f, assignee: e.target.value }))}>
            <option value="">Todos</option>
            <option value="none">Sem responsável</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={filters.overdueOnly} onChange={(e) => setFilters((f) => ({ ...f, overdueOnly: e.target.checked }))} />
          <span>Só atrasadas</span>
        </label>
        {filtered && (
          <button type="button" className="btn ghost small" onClick={() => setFilters(EMPTY_FILTERS)}>Limpar filtros</button>
        )}
      </div>

      <p id="move-help" className="sr-only">Enter abre a tarefa. Alt + setas esquerda e direita movem entre colunas; Alt + setas para cima e para baixo mudam a ordem.</p>

      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
        accessibility={{ announcements, screenReaderInstructions: { draggable: "Use os botões de mover ou Alt + setas." } }}
      >
        <main className="board">
          {columns.map((column) => {
            const all = cardsIn(board.cards, column.id);
            const shown = all.filter((c) => matchesFilters(c, filters, today));
            return (
              <ColumnView key={column.id} column={column} total={all.length} shown={shown.length} filtered={filtered} onAdd={() => setEditing({ mode: "new", column: column.id })}>
                {shown.map((card) => (
                  <CardView
                    key={card.id}
                    card={card}
                    today={today}
                    canLeft={canMove(board.cards, card.id, -1)}
                    canRight={canMove(board.cards, card.id, 1)}
                    onOpen={(id) => setEditing({ mode: "edit", id })}
                    onMove={moveBy}
                    onReorder={reorder}
                  />
                ))}
              </ColumnView>
            );
          })}
        </main>
        <DragOverlay dropAnimation={null}>
          {active ? <CardView card={active} today={today} canLeft={false} canRight={false} onOpen={() => {}} onMove={() => {}} onReorder={() => {}} overlay /> : null}
        </DragOverlay>
      </DndContext>

      <footer className="foot">
        <span>{saved ? "Salvo neste navegador." : "Não foi possível salvar neste navegador; as mudanças valem só nesta aba."}</span>
        <span className="shortcuts">
          <kbd>N</kbd> nova tarefa · <kbd>/</kbd> buscar · <kbd>Alt</kbd> + setas move o cartão em foco
        </span>
        <button type="button" className="link" onClick={resetDemo}>Restaurar demonstração</button>
      </footer>

      <div className="sr-only" role="status" aria-live="polite">{announcement}</div>

      {editing && (
        <CardDialog
          key={editing.mode === "edit" ? editing.id : `new-${editing.column}`}
          mode={editing.mode}
          cardId={editing.mode === "edit" ? editing.id : undefined}
          initial={
            editingCard
              ? { title: editingCard.title, description: editingCard.description, column: editingCard.column, labels: editingCard.labels, assignee: editingCard.assignee, due: editingCard.due }
              : { title: "", description: "", column: editing.mode === "new" ? editing.column : "backlog", labels: [], assignee: null, due: null }
          }
          onSave={save}
          onDelete={editing.mode === "edit" ? remove : undefined}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
