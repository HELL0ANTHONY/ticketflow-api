import type { Ticket, TicketIdInput } from "#/modules/tickets/domain/ticket.js";

import { NotFoundError } from "#/shared/errors/application-error.js";

import type { TicketRepository } from "./ports/ticket-repository.ts";

export class GetTicketByIdUseCase {
  constructor(private readonly ticketRepository: TicketRepository) {}

  async execute(input: TicketIdInput): Promise<Ticket> {
    const ticket = await this.ticketRepository.findById(input);

    if (ticket === undefined) {
      throw new NotFoundError("Ticket not found");
    }

    return ticket;
  }
}
