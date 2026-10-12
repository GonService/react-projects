export type Priority = "urgent" | "high" | "normal" | "low";
export type Status = "open" | "in_progress" | "waiting" | "resolved" | "closed";

export interface Ticket {
  id: number;
  title: string;
  requesterName: string;
  requesterEmail: string;
  category: string;
  priority: Priority;
  status: Status;
  assignee: string | null;
  createdAt: string; // ISO
  dueAt: string; // ISO
}

export type SlaState = "overdue" | "at_risk" | "on_track" | "done";
