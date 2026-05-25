import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { and, desc, eq, gte, lte } from "drizzle-orm";

import type { AuditRepository } from "#/modules/audit/application/ports/audit-repository.js";
import type {
  AuditEvent,
  ListAuditEventsFilters,
} from "#/modules/audit/domain/audit-event.js";
import type * as databaseSchema from "#/shared/db/schema.js";

import { ticketEvents } from "#/shared/db/schema.js";

type Database = NodePgDatabase<typeof databaseSchema>;

export class DrizzleAuditRepository implements AuditRepository {
  constructor(private readonly database: Database) {}

  async list(filters: ListAuditEventsFilters): Promise<AuditEvent[]> {
    const conditions = [
      filters.actorId === undefined
        ? undefined
        : eq(ticketEvents.actorId, filters.actorId),
      filters.eventType === undefined
        ? undefined
        : eq(ticketEvents.eventType, filters.eventType),
      filters.from === undefined
        ? undefined
        : gte(ticketEvents.createdAt, filters.from),
      filters.ticketId === undefined
        ? undefined
        : eq(ticketEvents.ticketId, filters.ticketId),
      filters.to === undefined
        ? undefined
        : lte(ticketEvents.createdAt, filters.to),
    ].filter(
      (condition): condition is NonNullable<typeof condition> =>
        condition !== undefined,
    );

    const whereCondition =
      conditions.length === 0 ? undefined : and(...conditions);

    return this.database.query.ticketEvents.findMany({
      orderBy: [desc(ticketEvents.createdAt)],
      where: whereCondition,
    });
  }
}
