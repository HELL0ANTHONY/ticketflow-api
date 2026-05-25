import type {
  AuditEvent,
  ListAuditEventsFilters,
} from "#/modules/audit/domain/audit-event.js";

export type AuditRepository = {
  list(filters: ListAuditEventsFilters): Promise<AuditEvent[]>;
};
