import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { CSSProperties, KeyboardEvent } from "react";
import { dueStatus, formatShortDate, initials } from "../board";
import { labels, people } from "../data";
import type { Card } from "../types";
import { CalendarIcon, ChevronLeft, ChevronRight } from "./Icons";

const DUE_TEXT = { overdue: "atrasada", today: "vence hoje", soon: "vence em breve", later: "" } as const;

interface Props {
  card: Card;
  today: string;
  canLeft: boolean;
  canRight: boolean;
  onOpen: (id: string) => void;
  onMove: (id: string, delta: -1 | 1) => void;
  onReorder: (id: string, delta: -1 | 1) => void;
  /** Rendered inside the drag overlay: no drag or drop wiring. */
  overlay?: boolean;
}

export function CardView({ card, today, canLeft, canRight, onOpen, onMove, onReorder, overlay }: Props) {
  const drag = useDraggable({ id: card.id, disabled: overlay });
  const drop = useDroppable({ id: `card:${card.id}`, disabled: overlay });
  const status = dueStatus(card, today);
  const person = people.find((p) => p.id === card.assignee);

  const onKeyDown = (e: KeyboardEvent) => {
    if (!e.altKey) return;
    const map = { ArrowLeft: () => canLeft && onMove(card.id, -1), ArrowRight: () => canRight && onMove(card.id, 1), ArrowUp: () => onReorder(card.id, -1), ArrowDown: () => onReorder(card.id, 1) } as const;
    const action = map[e.key as keyof typeof map];
    if (action) {
      e.preventDefault();
      action();
    }
  };

  const setRef = (el: HTMLElement | null) => {
    drag.setNodeRef(el);
    drop.setNodeRef(el);
  };

  return (
    <article
      ref={overlay ? undefined : setRef}
      {...(overlay ? {} : drag.listeners)}
      className={`card${drag.isDragging ? " is-dragging" : ""}${drop.isOver && !drag.isDragging ? " is-over" : ""}${overlay ? " is-overlay" : ""}`}
      data-due={status ?? undefined}
      onKeyDown={onKeyDown}
      aria-label={card.title}
    >
      {card.labels.length > 0 && (
        <ul className="card-labels" aria-label="Etiquetas">
          {card.labels.map((id) => {
            const label = labels.find((l) => l.id === id);
            return label ? (
              <li key={id} style={{ "--label": label.color } as CSSProperties}>{label.name}</li>
            ) : null;
          })}
        </ul>
      )}
      <button type="button" className="card-title" data-card-title={card.id} onClick={() => onOpen(card.id)} aria-describedby="move-help">
        {card.title}
      </button>
      <div className="card-foot">
        <span className="card-id">{card.id}</span>
        {card.due && (
          <span className={`due due-${status}`}>
            <CalendarIcon />
            <span>{formatShortDate(card.due)}</span>
            {status && DUE_TEXT[status] && <span className="sr-only">, {DUE_TEXT[status]}</span>}
          </span>
        )}
        <span className="spacer" />
        {person ? (
          <span className="avatar" title={person.name} aria-label={`Responsável: ${person.name}`} role="img">{initials(person.name)}</span>
        ) : (
          <span className="avatar empty" title="Sem responsável" aria-label="Sem responsável" role="img" />
        )}
      </div>
      {!overlay && (
        <div className="card-move">
          <button type="button" className="mini" disabled={!canLeft} onClick={() => onMove(card.id, -1)} aria-label={`Mover "${card.title}" para a coluna anterior`} title="Coluna anterior (Alt + ←)">
            <ChevronLeft />
          </button>
          <button type="button" className="mini" disabled={!canRight} onClick={() => onMove(card.id, 1)} aria-label={`Mover "${card.title}" para a próxima coluna`} title="Próxima coluna (Alt + →)">
            <ChevronRight />
          </button>
        </div>
      )}
    </article>
  );
}
