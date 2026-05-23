import type {
  AuditEvent,
  ListTicketAuditEventsInput,
} from "#/modules/audit/domain/audit-event.js";

import { NotFoundError } from "#/shared/errors/application-error.js";

import type { AuditRepository } from "./ports/audit-repository.js";

export class ListTicketAuditEventsUseCase {
  constructor(private readonly auditRepository: AuditRepository) {}

  async execute(input: ListTicketAuditEventsInput): Promise<AuditEvent[]> {
    const ticket = await this.auditRepository.findTicketById(input.ticketId);

    if (ticket === undefined) {
      throw new NotFoundError("Ticket not found");
    }

    return this.auditRepository.list({ ticketId: input.ticketId });
  }
}
