export const ticketEventTypes = [
  "ticket_created",
  "ticket_assigned",
  "ticket_status_changed",
  "comment_added",
  "ticket_closed",
] as const;

export type TicketEventType = (typeof ticketEventTypes)[number];
