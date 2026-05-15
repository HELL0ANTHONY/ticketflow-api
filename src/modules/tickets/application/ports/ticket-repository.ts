import type {
  CreateTicketInput,
  ListTicketsFilters,
  Ticket,
} from "#/modules/tickets/domain/ticket.js";

export type TicketRepository = {
  create(input: CreateTicketInput): Promise<Ticket>;
  list(filters: ListTicketsFilters): Promise<Ticket[]>;
};
