import type {
  AssignTicketInput,
  ChangeTicketStatusInput,
  CreateTicketInput,
  GetTicketByIdInput,
  ListTicketsFilters,
  Ticket,
  TicketUserSummary,
} from "#/modules/tickets/domain/ticket.js";

export type TicketRepository = {
  assign(input: AssignTicketInput): Promise<Ticket>;
  changeStatus(input: ChangeTicketStatusInput): Promise<Ticket>;
  create(input: CreateTicketInput): Promise<Ticket>;
  findById(input: GetTicketByIdInput): Promise<Ticket | undefined>;
  findUserById(id: string): Promise<TicketUserSummary | undefined>;
  list(filters: ListTicketsFilters): Promise<Ticket[]>;
};
