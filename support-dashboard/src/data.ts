import type { Priority, Status, Ticket } from "./types";

const SLA_HOURS: Record<Priority, number> = { urgent: 4, high: 8, normal: 24, low: 72 };
const HOUR = 3600 * 1000;

const SAMPLES: [string, string, Priority, Status, string | null, number][] = [
  // title, category, priority, status, assignee, hours since created
  ["Checkout returns error 500 for card payments", "Payments", "urgent", "in_progress", "marina", 5],
  ["Website very slow since the 9am deploy", "Infrastructure", "urgent", "open", null, 2.5],
  ["Invoice PDF shows the old company address", "Billing", "normal", "open", "rafael", 20],
  ["Cannot reset password: email never arrives", "Access", "high", "waiting", "marina", 6.5],
  ["Export to Excel downloads an empty file", "Reports", "normal", "in_progress", "rafael", 9],
  ["New user for the finance team", "Access", "low", "open", null, 30],
  ["Payment confirmation webhook failing", "Payments", "high", "open", null, 7.8],
  ["Mobile app crashes when opening orders", "App", "urgent", "open", "joao", 1],
  ["Add CNPJ field to the customer form", "Feature request", "low", "open", null, 50],
  ["Daily backup job reported a warning", "Infrastructure", "high", "in_progress", "joao", 3],
  ["Discount coupon accepted twice", "Payments", "normal", "resolved", "marina", 26],
  ["Change notification sender name", "Settings", "low", "closed", "rafael", 70],
  ["Stock count differs between store and ERP", "Integrations", "high", "open", "joao", 9.5],
  ["Report filter by seller ignores dates", "Reports", "normal", "waiting", null, 22],
];

const PEOPLE = ["Ana Souza", "Bruno Lima", "Carla Dias", "Diego Rocha", "Elisa Prado", "Fábio Nunes"];

/** Demo data relative to "now", so the dashboard always shows a realistic mix of SLA states. */
export function demoTickets(now: number = Date.now()): Ticket[] {
  return SAMPLES.map(([title, category, priority, status, assignee, hoursAgo], i) => {
    const created = now - hoursAgo * HOUR;
    const name = PEOPLE[i % PEOPLE.length]!;
    return {
      id: 1040 + i,
      title,
      category,
      priority,
      status,
      assignee,
      requesterName: name,
      requesterEmail: name.split(" ")[0]!.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") + "@example.com",
      createdAt: new Date(created).toISOString(),
      dueAt: new Date(created + SLA_HOURS[priority] * HOUR).toISOString(),
    };
  });
}
