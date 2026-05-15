import type {
  CreateTicketInput,
  Ticket,
} from "#/modules/tickets/domain/ticket.js";

import type { TicketRepository } from "./ports/ticket-repository.js";

export class CreateTicketUseCase {
  constructor(private readonly ticketRepository: TicketRepository) {}

  execute(input: CreateTicketInput): Promise<Ticket> {
    return this.ticketRepository.create(input);
  }
}
