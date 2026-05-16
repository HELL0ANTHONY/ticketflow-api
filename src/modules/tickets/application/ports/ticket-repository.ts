import type {
  CreateTicketInput,
  GetTicketByIdInput,
  ListTicketsFilters,
  Ticket,
} from "#/modules/tickets/domain/ticket.js";

export type TicketRepository = {
  create(input: CreateTicketInput): Promise<Ticket>;
  findById(input: GetTicketByIdInput): Promise<Ticket | undefined>;
  list(filters: ListTicketsFilters): Promise<Ticket[]>;
};
