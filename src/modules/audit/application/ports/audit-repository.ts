import type {
  AuditEvent,
  AuditTicketSummary,
  ListAuditEventsFilters,
} from "#/modules/audit/domain/audit-event.js";

export type AuditRepository = {
  findTicketById(id: string): Promise<AuditTicketSummary | undefined>;
  list(filters: ListAuditEventsFilters): Promise<AuditEvent[]>;
};
