import type { FastifyInstance } from "fastify";

import { z } from "zod";

import type {
  CreateTicketInput,
  ListTicketsFilters,
} from "#/modules/tickets/domain/ticket.js";

import { CreateTicketUseCase } from "#/modules/tickets/application/create-ticket.use-case.js";
import { GetTicketByIdUseCase } from "#/modules/tickets/application/get-ticket-by-id.use-case.js";
import { ListTicketsUseCase } from "#/modules/tickets/application/list-tickets.use-case.js";
import {
  ticketPriorities,
  ticketStatuses,
} from "#/modules/tickets/domain/ticket.js";
import { DrizzleTicketRepository } from "#/modules/tickets/infrastructure/drizzle-ticket.repository.js";
import { db } from "#/shared/db/client.js";

const createTicketBodySchema = z
  .object({
    createdBy: z.uuid(),
    description: z.string().trim().min(1).max(4_000),
    priority: z.enum(ticketPriorities).optional(),
    title: z.string().trim().min(1).max(200),
  })
  .strict();

const listTicketsQuerySchema = z
  .object({
    priority: z.enum(ticketPriorities).optional(),
    status: z.enum(ticketStatuses).optional(),
  })
  .strict();

const ticketIdParamsSchema = z.object({ id: z.uuid() });

export function ticketRoutes(app: FastifyInstance): void {
  const ticketRepository = new DrizzleTicketRepository(db);
  const createTicketUseCase = new CreateTicketUseCase(ticketRepository);
  const listTicketsUseCase = new ListTicketsUseCase(ticketRepository);
  const getTicketByIdUseCase = new GetTicketByIdUseCase(ticketRepository);

  app.post("/tickets", async (request, reply) => {
    const body = createTicketBodySchema.parse(request.body);
    const input: CreateTicketInput = {
      createdBy: body.createdBy,
      description: body.description,
      ...(body.priority === undefined ? {} : { priority: body.priority }),
      title: body.title,
    };
    const ticket = await createTicketUseCase.execute(input);

    return reply.code(201).send({ data: ticket });
  });

  app.get("/tickets", async (request) => {
    const query = listTicketsQuerySchema.parse(request.query);
    const filters: ListTicketsFilters = {
      ...(query.priority === undefined ? {} : { priority: query.priority }),
      ...(query.status === undefined ? {} : { status: query.status }),
    };
    const tickets = await listTicketsUseCase.execute(filters);

    return { data: tickets };
  });

  app.get("/ticket/:id", async (request) => {
    const params = ticketIdParamsSchema.parse(request.params);
    const ticket = await getTicketByIdUseCase.execute({ id: params.id });

    return { data: ticket };
  });
}
