import { PRIORITY_LABEL, STATUS_LABEL, slaState, timeLeftLabel } from "../logic";
import type { Ticket } from "../types";

interface Props {
  tickets: Ticket[];
  now: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export function TicketTable({ tickets, now, selectedId, onSelect }: Props) {
  if (tickets.length === 0) {
    return <p className="empty">No tickets match these filters. Clear the search or choose “All tickets”.</p>;
  }
  return (
    <table className="tickets">
      <thead>
        <tr>
          <th scope="col">#</th>
          <th scope="col">Ticket</th>
          <th scope="col">Priority</th>
          <th scope="col">Status</th>
          <th scope="col">Assignee</th>
          <th scope="col" className="num">SLA</th>
        </tr>
      </thead>
      <tbody>
        {tickets.map((t) => {
          const sla = slaState(t, now);
          return (
            <tr
              key={t.id}
              className={t.id === selectedId ? "selected" : undefined}
              onClick={() => onSelect(t.id)}
              aria-selected={t.id === selectedId}
            >
              <td className="id">{t.id}</td>
              <td>
                <span className="title">{t.title}</span>
                <span className="sub">
                  {t.requesterName} · {t.category}
                </span>
              </td>
              <td>
                <span className={`prio prio-${t.priority}`}>{PRIORITY_LABEL[t.priority]}</span>
              </td>
              <td>{STATUS_LABEL[t.status]}</td>
              <td>{t.assignee ?? <span className="muted">Unassigned</span>}</td>
              <td className={`num sla sla-${sla}`}>{sla === "done" ? "—" : timeLeftLabel(t, now)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
