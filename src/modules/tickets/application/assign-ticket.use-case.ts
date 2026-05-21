import type {
  AssignTicketInput,
  Ticket,
  TicketUserSummary,
} from "#/modules/tickets/domain/ticket.js";

import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "#/shared/errors/application-error.js";

import type { TicketRepository } from "./ports/ticket-repository.js";

export class AssignTicketUseCase {
  constructor(private readonly ticketRepository: TicketRepository) {}

  async execute(input: AssignTicketInput): Promise<Ticket> {
    const ticket = await this.ticketRepository.findById({ id: input.ticketId });

    if (ticket === undefined) {
      throw new NotFoundError("Ticket not found");
    }

    if (ticket.status === "closed" || ticket.status === "cancelled") {
      throw new ConflictError("Cannot assign a closed or cancelled ticket");
    }

    const actor = await this.ticketRepository.findUserById(input.actorId);

    if (actor === undefined) {
      throw new NotFoundError("Actor not found");
    }

    if (!canAssignTickets(actor)) {
      throw new ForbiddenError("Actor cannot assign tickets");
    }

    const assignee = await this.ticketRepository.findUserById(input.assignedTo);

    if (assignee === undefined) {
      throw new NotFoundError("Assigned user not found");
    }

    if (!canReceiveTickets(assignee)) {
      throw new ConflictError("Assigned user must be an agent or admin");
    }

    return this.ticketRepository.assign(input);
  }
}

function canAssignTickets(user: TicketUserSummary): boolean {
  return user.role === "admin" || user.role === "agent";
}

function canReceiveTickets(user: TicketUserSummary): boolean {
  return user.role === "admin" || user.role === "agent";
}
