import type { FastifyInstance } from "fastify";

import { z } from "zod";

import type {
  ListAuditEventsFilters,
  ListTicketAuditEventsInput,
} from "#/modules/audit/domain/audit-event.js";

import { ListAuditEventsUseCase } from "#/modules/audit/application/list-audit-events.use-case.js";
import { ListTicketAuditEventsUseCase } from "#/modules/audit/application/list-ticket-audit-events.use-case.js";
import { DrizzleAuditRepository } from "#/modules/audit/infrastructure/drizzle-audit.repository.js";
import { db } from "#/shared/db/client.js";
import { ticketEventTypes } from "#/shared/domain/ticket-event.js";

const ticketIdParamsSchema = z.object({ id: z.uuid() }).strict();

const listAuditEventsQuerySchema = z
  .object({
    actorId: z.uuid().optional(),
    eventType: z.enum(ticketEventTypes).optional(),
    from: z.coerce.date().optional(),
    ticketId: z.uuid().optional(),
    to: z.coerce.date().optional(),
  })
  .strict();

export function auditRoutes(app: FastifyInstance): void {
  const auditRepository = new DrizzleAuditRepository(db);
  const listAuditEventsUseCase = new ListAuditEventsUseCase(auditRepository);
  const listTicketAuditEventsUseCase = new ListTicketAuditEventsUseCase(
    auditRepository,
  );

  app.get("/audit/events", async (request) => {
    const query = listAuditEventsQuerySchema.parse(request.query);
    const filters: ListAuditEventsFilters = {
      ...(query.actorId === undefined ? {} : { actorId: query.actorId }),
      ...(query.eventType === undefined ? {} : { eventType: query.eventType }),
      ...(query.from === undefined ? {} : { from: query.from }),
      ...(query.ticketId === undefined ? {} : { ticketId: query.ticketId }),
      ...(query.to === undefined ? {} : { to: query.to }),
    };

    const events = await listAuditEventsUseCase.execute(filters);

    return { data: events };
  });

  app.get("/tickets/:id/events", async (request) => {
    const params = ticketIdParamsSchema.parse(request.params);
    const input: ListTicketAuditEventsInput = { ticketId: params.id };

    const events = await listTicketAuditEventsUseCase.execute(input);

    return { data: events };
  });
}
