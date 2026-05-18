export const ticketPriorities = ["low", "medium", "high", "critical"] as const;

export const ticketStatuses = [
  "open",
  "assigned",
  "in_progress",
  "resolved",
  "closed",
  "cancelled",
] as const;

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
  ticketId: string;
  actorId: string;
  assignedTo: string;
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

export type TicketPriority = (typeof ticketPriorities)[number];

export type TicketStatus = (typeof ticketStatuses)[number];
