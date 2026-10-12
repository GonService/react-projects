import { demoTickets } from "./data";
import type { Ticket } from "./types";

interface ApiTicket {
  id: number;
  title: string;
  requester_name: string;
  requester_email: string;
  category: string;
  priority: Ticket["priority"];
  status: Ticket["status"];
  assignee: string | null;
  created_at: string;
  due_at: string;
}

/**
 * Loads tickets from the django-helpdesk API when VITE_API_URL and VITE_API_TOKEN are set,
 * otherwise returns demo data.
 */
export async function loadTickets(fetchImpl: typeof fetch = fetch): Promise<{ tickets: Ticket[]; source: "api" | "demo" }> {
  const base = import.meta.env.VITE_API_URL as string | undefined;
  const token = import.meta.env.VITE_API_TOKEN as string | undefined;
  if (!base || !token) return { tickets: demoTickets(), source: "demo" };

  const tickets: Ticket[] = [];
  let url: string | null = `${base.replace(/\/$/, "")}/api/tickets/?page_size=100`;
  while (url) {
    const res = await fetchImpl(url, { headers: { Authorization: `Token ${token}` } });
    if (!res.ok) throw new Error(`The helpdesk API answered ${res.status}. Check VITE_API_URL and VITE_API_TOKEN.`);
    const page = (await res.json()) as { next: string | null; results: ApiTicket[] };
    for (const t of page.results) {
      tickets.push({
        id: t.id,
        title: t.title,
        requesterName: t.requester_name,
        requesterEmail: t.requester_email,
        category: t.category,
        priority: t.priority,
        status: t.status,
        assignee: t.assignee,
        createdAt: t.created_at,
        dueAt: t.due_at,
      });
    }
    url = page.next;
  }
  return { tickets, source: "api" };
}
