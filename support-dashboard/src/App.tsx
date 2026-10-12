import { useEffect, useMemo, useState } from "react";
import { loadTickets } from "./api";
import { SlaTimeline } from "./components/SlaTimeline";
import { TicketTable } from "./components/TicketTable";
import { DEFAULT_FILTERS, PRIORITIES, PRIORITY_LABEL, applyFilters, sortTickets, summarize, type Filters, type SortKey } from "./logic";
import type { Ticket } from "./types";

interface Props {
  /** Injected in tests; the app loads from the API or demo data otherwise. */
  initialTickets?: Ticket[];
  now?: number;
}

export default function App({ initialTickets, now: fixedNow }: Props) {
  const [tickets, setTickets] = useState<Ticket[] | null>(initialTickets ?? null);
  const [source, setSource] = useState<"api" | "demo">("demo");
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortKey>("due");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [clock, setClock] = useState(() => fixedNow ?? Date.now());

  useEffect(() => {
    if (initialTickets) return;
    loadTickets()
      .then((r) => {
        setTickets(r.tickets);
        setSource(r.source);
      })
      .catch((e: Error) => setError(e.message));
  }, [initialTickets]);

  useEffect(() => {
    if (fixedNow !== undefined) return;
    const id = setInterval(() => setClock(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [fixedNow]);

  const now = fixedNow ?? clock;
  const all = tickets ?? [];
  const summary = useMemo(() => summarize(all, now), [all, now]);
  const visible = useMemo(() => sortTickets(applyFilters(all, filters, now), sort), [all, filters, now, sort]);
  const assignees = useMemo(() => [...new Set(all.map((t) => t.assignee).filter((a): a is string => !!a))].sort(), [all]);
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((f) => ({ ...f, [key]: value }));

  if (error) return <main className="page"><p className="error" role="alert">{error}</p></main>;
  if (!tickets) return <main className="page"><p className="muted">Loading tickets…</p></main>;

  return (
    <main className="page">
      <header className="head">
        <div>
          <h1>Support queue</h1>
          <p className="muted">
            {source === "demo" ? "Demo data. Set VITE_API_URL and VITE_API_TOKEN to read from the helpdesk API." : "Live from the helpdesk API."}
          </p>
        </div>
        <dl className="summary" aria-label="Queue summary">
          <div><dt>Open</dt><dd>{summary.open}</dd></div>
          <div className={summary.overdue ? "alert" : undefined}><dt>Late</dt><dd>{summary.overdue}</dd></div>
          <div className={summary.atRisk ? "warn" : undefined}><dt>Due within 2 h</dt><dd>{summary.atRisk}</dd></div>
          <div><dt>Unassigned</dt><dd>{summary.unassigned}</dd></div>
        </dl>
      </header>

      <SlaTimeline tickets={all} now={now} selectedId={selectedId} onSelect={setSelectedId} />

      <section className="controls" aria-label="Filters">
        <div className="segmented" role="group" aria-label="Show">
          {(["open", "overdue", "all"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={filters.view === v} onClick={() => set("view", v)}>
              {v === "open" ? "Open" : v === "overdue" ? "Late" : "All tickets"}
            </button>
          ))}
        </div>
        <label>
          Search
          <input type="search" value={filters.query} placeholder="Title, customer, #id" onChange={(e) => set("query", e.target.value)} />
        </label>
        <label>
          Priority
          <select value={filters.priority} onChange={(e) => set("priority", e.target.value as Filters["priority"])}>
            <option value="all">Any</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
          </select>
        </label>
        <label>
          Assignee
          <select value={filters.assignee} onChange={(e) => set("assignee", e.target.value)}>
            <option value="all">Anyone</option>
            <option value="unassigned">Unassigned</option>
            {assignees.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label>
          Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="due">Deadline</option>
            <option value="priority">Priority</option>
            <option value="created">Newest</option>
          </select>
        </label>
      </section>

      <p className="count" aria-live="polite">{visible.length} of {all.length} tickets</p>
      <TicketTable tickets={visible} now={now} selectedId={selectedId} onSelect={setSelectedId} />
    </main>
  );
}
