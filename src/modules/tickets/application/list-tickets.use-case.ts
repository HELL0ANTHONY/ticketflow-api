import type {
  ListTicketsFilters,
  Ticket,
} from "#/modules/tickets/domain/ticket.js";

import type { TicketRepository } from "./ports/ticket-repository.js";

export class ListTicketsUseCase {
  constructor(private readonly ticketRepository: TicketRepository) {}

  execute(filters: ListTicketsFilters): Promise<Ticket[]> {
    return this.ticketRepository.list(filters);
  }
}
