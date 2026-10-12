import { useRef, type KeyboardEvent } from "react";
import { formatLongDate, formatMonth } from "../format";
import { addDays, monthGrid, parseISODate } from "../slots";

interface Props {
  year: number;
  month: number;
  today: string;
  selected: string | null;
  isAvailable: (date: string) => boolean;
  canPrev: boolean;
  canNext: boolean;
  onMonthChange: (delta: number) => void;
  onSelect: (date: string) => void;
}

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** Month grid with roving focus: Tab enters once, arrow keys move between days. */
export function Calendar(props: Props) {
  const { year, month, today, selected, isAvailable } = props;
  const grid = monthGrid(year, month);
  const ref = useRef<HTMLDivElement>(null);
  const days = grid.flat().filter((d): d is string => d !== null);
  const focusable = (selected && days.includes(selected) ? selected : days.find(isAvailable)) ?? days[0];

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const current = (e.target as HTMLElement).dataset.date;
    if (!current) return;
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    let target: string | undefined;
    if (delta) target = addDays(current, delta);
    if (e.key === "Home") target = addDays(current, -parseISODate(current).getDay());
    if (e.key === "End") target = addDays(current, 6 - parseISODate(current).getDay());
    if (!target) return;
    e.preventDefault();
    const button = ref.current?.querySelector<HTMLButtonElement>(`[data-date="${target}"]`);
    button?.focus();
  };

  return (
    <div className="calendar">
      <div className="calendar-head">
        <button type="button" className="icon-btn" onClick={() => props.onMonthChange(-1)} disabled={!props.canPrev} aria-label="Mês anterior">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" /></svg>
        </button>
        <h3 aria-live="polite">{formatMonth(year, month)}</h3>
        <button type="button" className="icon-btn" onClick={() => props.onMonthChange(1)} disabled={!props.canNext} aria-label="Próximo mês">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>
        </button>
      </div>
      <div className="calendar-grid" role="group" aria-label={`Dias de ${formatMonth(year, month)}`} ref={ref} onKeyDown={onKeyDown}>
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="weekday" aria-hidden="true" title={WEEKDAY_NAMES[i]}>{w}</span>
        ))}
        {grid.flat().map((date, i) => {
          if (!date) return <span key={`blank-${i}`} />;
          const available = isAvailable(date);
          const label = `${formatLongDate(date)}${available ? "" : ", indisponível"}`;
          return (
            <button
              key={date}
              type="button"
              data-date={date}
              className="day"
              tabIndex={date === focusable ? 0 : -1}
              aria-label={label}
              aria-disabled={!available}
              aria-pressed={date === selected}
              data-today={date === today || undefined}
              onClick={() => available && props.onSelect(date)}
            >
              {Number(date.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
