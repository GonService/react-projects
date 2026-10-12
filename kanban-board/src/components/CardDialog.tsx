import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from "react";
import { columns, labels, people } from "../data";
import type { Card, ColumnId } from "../types";
import { Close } from "./Icons";

export type Draft = Pick<Card, "title" | "description" | "column" | "labels" | "assignee" | "due">;

interface Props {
  mode: "new" | "edit";
  initial: Draft;
  cardId?: string;
  onSave: (draft: Draft) => void;
  onDelete?: () => void;
  onClose: () => void;
}

/** Modal editor. Focus is trapped inside, Escape closes, and focus returns to the opener. */
export function CardDialog({ mode, initial, cardId, onSave, onDelete, onClose }: Props) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    titleRef.current?.focus();
    return () => {
      // The opener may have been re-rendered; fall back to the card title by id.
      const target = opener?.isConnected ? opener : cardId ? document.querySelector<HTMLElement>(`[data-card-title="${cardId}"]`) : null;
      target?.focus();
    };
  }, [cardId]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim()) {
      setError("Dê um título para a tarefa.");
      titleRef.current?.focus();
      return;
    }
    onSave({ ...draft, title: draft.title.trim(), description: draft.description.trim() });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button, input, select, textarea") ?? []).filter((el) => !el.hasAttribute("disabled"));
    const first = focusable[0];
    const last = focusable.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  };

  const heading = mode === "new" ? "Nova tarefa" : `Editar ${cardId}`;

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialogRef} className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onKeyDown={onKeyDown}>
        <header className="dialog-head">
          <h2 id="dialog-title">{heading}</h2>
          <button type="button" className="mini" onClick={onClose} aria-label="Fechar">
            <Close />
          </button>
        </header>
        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="f-title">Título</label>
            <input
              id="f-title"
              ref={titleRef}
              value={draft.title}
              maxLength={120}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "f-title-error" : undefined}
              onChange={(e) => {
                set("title", e.target.value);
                if (error) setError(null);
              }}
            />
            {error && <p id="f-title-error" className="error">{error}</p>}
          </div>
          <div className="field">
            <label htmlFor="f-desc">Descrição</label>
            <textarea id="f-desc" rows={3} value={draft.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="f-column">Coluna</label>
              <select id="f-column" value={draft.column} onChange={(e) => set("column", e.target.value as ColumnId)}>
                {columns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-assignee">Responsável</label>
              <select id="f-assignee" value={draft.assignee ?? ""} onChange={(e) => set("assignee", e.target.value || null)}>
                <option value="">Sem responsável</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-due">Prazo</label>
              <input id="f-due" type="date" value={draft.due ?? ""} onChange={(e) => set("due", e.target.value || null)} />
            </div>
          </div>
          <fieldset className="field labels-field">
            <legend>Etiquetas</legend>
            <div className="label-options">
              {labels.map((l) => (
                <label key={l.id} className="label-option" style={{ "--label": l.color } as CSSProperties}>
                  <input
                    type="checkbox"
                    checked={draft.labels.includes(l.id)}
                    onChange={(e) => set("labels", e.target.checked ? [...draft.labels, l.id] : draft.labels.filter((x) => x !== l.id))}
                  />
                  <span>{l.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <footer className="dialog-actions">
            {onDelete && (
              confirmDelete ? (
                <button type="button" className="btn danger" onClick={onDelete}>Confirmar exclusão</button>
              ) : (
                <button type="button" className="btn ghost danger-text" onClick={() => setConfirmDelete(true)}>Excluir</button>
              )
            )}
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn primary">{mode === "new" ? "Criar tarefa" : "Salvar"}</button>
          </footer>
        </form>
      </div>
    </div>
  );
}
