import type {
  CreateTicketInput,
  ListTicketsFilters,
  Ticket,
  TicketIdInput,
} from "#/modules/tickets/domain/ticket.js";

export type TicketRepository = {
  create(input: CreateTicketInput): Promise<Ticket>;
  findById(input: TicketIdInput): Promise<Ticket | undefined>;
  list(filters: ListTicketsFilters): Promise<Ticket[]>;
};
