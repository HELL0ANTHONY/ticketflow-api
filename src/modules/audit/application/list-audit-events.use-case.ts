import type {
  AuditEvent,
  ListAuditEventsFilters,
} from "#/modules/audit/domain/audit-event.js";

import { ValidationError } from "#/shared/errors/application-error.js";

import type { AuditRepository } from "./ports/audit-repository.js";

export class ListAuditEventsUseCase {
  constructor(private readonly auditRepository: AuditRepository) {}

  async execute(filters: ListAuditEventsFilters): Promise<AuditEvent[]> {
    if (
      filters.from !== undefined &&
      filters.to !== undefined &&
      filters.from > filters.to
    ) {
      throw new ValidationError("from must be before or equal to to");
    }

    return this.auditRepository.list(filters);
  }
}
