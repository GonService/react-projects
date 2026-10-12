import { PRIORITIES, PRIORITY_LABEL, isOpen, timeLeftLabel } from "../logic";
import type { Ticket } from "../types";

const HOUR = 3600 * 1000;
const PAST_H = 6; // hours shown to the left of "now" (late)
const FUTURE_H = 12; // hours shown to the right of "now"
const W = 880;
const LANE_H = 34;
const LEFT = 78;
const TOP = 26;
const RIGHT = 16;

interface Props {
  tickets: Ticket[];
  now: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
}

/** Open tickets placed by SLA deadline relative to now: left of the line = late. */
export function SlaTimeline({ tickets, now, selectedId, onSelect }: Props) {
  const open = tickets.filter(isOpen);
  const plotW = W - LEFT - RIGHT;
  const x = (dueMs: number) => {
    const h = (dueMs - now) / HOUR;
    const clamped = Math.max(-PAST_H, Math.min(FUTURE_H, h));
    return LEFT + ((clamped + PAST_H) / (PAST_H + FUTURE_H)) * plotW;
  };
  const height = TOP + PRIORITIES.length * LANE_H + 8;
  const nowX = x(now);
  const ticks = [-6, -3, 0, 3, 6, 9, 12];
  const later = open.filter((t) => Date.parse(t.dueAt) - now > FUTURE_H * HOUR).length;

  return (
    <figure className="timeline">
      <figcaption>
        <strong>Deadlines</strong> — each dot is an open ticket placed at its SLA deadline. Everything left of
        <em> now</em> is already late.
        {later > 0 && <span className="muted"> {later} more due after 12 h.</span>}
      </figcaption>
      <div className="timeline-scroll">
      <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label="Open tickets by time left to their SLA deadline">
        <rect x={LEFT} y={TOP - 6} width={nowX - LEFT} height={PRIORITIES.length * LANE_H + 6} className="late-zone" />
        {ticks.map((h) => {
          const tx = LEFT + ((h + PAST_H) / (PAST_H + FUTURE_H)) * plotW;
          return (
            <g key={h}>
              <line x1={tx} x2={tx} y1={TOP - 6} y2={height - 8} className={h === 0 ? "now-line" : "grid-line"} />
              <text x={tx} y={TOP - 12} textAnchor="middle" className={h === 0 ? "now-label" : "tick"}>
                {h === 0 ? "now" : h > 0 ? `+${h} h` : `${h} h`}
              </text>
            </g>
          );
        })}
        {PRIORITIES.map((p, lane) => {
          const y = TOP + lane * LANE_H + LANE_H / 2;
          // Tickets due after the visible window are counted in the caption instead of piling up at the edge
          const inLane = open.filter((t) => t.priority === p && Date.parse(t.dueAt) - now <= FUTURE_H * HOUR);
          return (
            <g key={p}>
              <text x={LEFT - 10} y={y + 4} textAnchor="end" className="lane-label">
                {PRIORITY_LABEL[p]}
              </text>
              <line x1={LEFT} x2={W - RIGHT} y1={y} y2={y} className="lane-line" />
              {inLane.map((t) => {
                const cx = x(Date.parse(t.dueAt));
                const selected = t.id === selectedId;
                return (
                  <g
                    key={t.id}
                    className={`dot dot-${p}${selected ? " selected" : ""}`}
                    tabIndex={0}
                    role="button"
                    aria-label={`#${t.id} ${t.title}, ${timeLeftLabel(t, now)}`}
                    onClick={() => onSelect(t.id)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(t.id)}
                  >
                    <title>{`#${t.id} ${t.title} — ${timeLeftLabel(t, now)}`}</title>
                    <circle cx={cx} cy={y} r={selected ? 9 : 7} />
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      </div>
    </figure>
  );
}
