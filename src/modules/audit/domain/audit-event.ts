import type { TicketEventType } from "#/shared/domain/ticket-event.js";

export type AuditEvent = {
  actorId: null | string;
  createdAt: Date;
  eventType: TicketEventType;
  id: string;
  metadata: unknown;
  ticketId: string;
};

export type ListAuditEventsFilters = {
  actorId?: string;
  eventType?: TicketEventType;
  from?: Date;
  ticketId?: string;
  to?: Date;
};

export type ListTicketAuditEventsInput = {
  ticketId: string;
};

export type AuditTicketSummary = {
  id: string;
};
