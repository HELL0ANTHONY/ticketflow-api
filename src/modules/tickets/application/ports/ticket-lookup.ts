import type { TicketSummary } from "#/modules/tickets/domain/ticket.js";

export type TicketLookup = {
  findTicketSummaryById(id: string): Promise<TicketSummary | undefined>;
};
