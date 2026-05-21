export const ticketPriorities = ["low", "medium", "high", "critical"] as const;
export type TicketPriority = (typeof ticketPriorities)[number];

export const ticketStatuses = [
  "open",
  "assigned",
  "in_progress",
  "resolved",
  "closed",
  "cancelled",
] as const;

export type TicketStatus = (typeof ticketStatuses)[number];

export type CreateTicketInput = {
  createdBy: string;
  description: string;
  priority?: TicketPriority;
  title: string;
};

export type ListTicketsFilters = {
  priority?: TicketPriority;
  status?: TicketStatus;
};

export type GetTicketByIdInput = {
  id: string;
};

export type AssignTicketInput = {
  actorId: string;
  assignedTo: string;
  ticketId: string;
};

export type Ticket = {
  assignedTo: null | string;
  closedAt: Date | null;
  createdAt: Date;
  createdBy: string;
  description: string;
  id: string;
  priority: TicketPriority;
  status: TicketStatus;
  title: string;
  updatedAt: Date;
};

export type TicketUserSummary = {
  id: string;
  role: "admin" | "agent" | "customer";
};
