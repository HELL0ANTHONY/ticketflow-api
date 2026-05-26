import type {
  ChangeTicketStatusInput,
  Ticket,
} from "#/modules/tickets/domain/ticket.js";
import type { UserLookup } from "#/modules/users/application/ports/user-lookup.js";

import { canTransitionTicketStatus } from "#/modules/tickets/domain/ticket.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "#/shared/errors/application-error.js";
import { canChangeTicketStatus } from "#/shared/security/permissions.js";

import type { TicketRepository } from "./ports/ticket-repository.js";

export class ChangeTicketStatusUseCase {
  constructor(
    private readonly ticketRepository: TicketRepository,
    private readonly userLookup: UserLookup,
  ) {}

  async execute(input: ChangeTicketStatusInput): Promise<Ticket> {
    const ticket = await this.ticketRepository.findById({ id: input.ticketId });
    if (ticket === undefined) {
      throw new NotFoundError("Ticket not found");
    }

    const actor = await this.userLookup.findUserSummaryById(input.actorId);
    if (actor === undefined) {
      throw new NotFoundError("Actor not found");
    }

    if (!canChangeTicketStatus(actor)) {
      throw new ForbiddenError("Actor cannot change ticket status");
    }

    if (!canTransitionTicketStatus(ticket.status, input.status)) {
      throw new ConflictError(
        `Cannot transition ticket from '${ticket.status}' to '${input.status}'`,
      );
    }

    if (
      (input.status === "assigned" || input.status === "in_progress") &&
      ticket.assignedTo === null
    ) {
      throw new ConflictError(
        `Cannot set status to '${input.status}' without an assigned user`,
      );
    }

    return this.ticketRepository.changeStatus(input);
  }
}
