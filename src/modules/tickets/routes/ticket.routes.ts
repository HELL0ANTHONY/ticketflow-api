import type { FastifyInstance } from "fastify";

import { z } from "zod";

import type {
  AssignTicketInput,
  CreateTicketInput,
  GetTicketByIdInput,
  ListTicketsFilters,
} from "#/modules/tickets/domain/ticket.js";

import { AssignTicketUseCase } from "#/modules/tickets/application/assign-ticket.use-case.js";
import { ChangeTicketStatusUseCase } from "#/modules/tickets/application/change-ticket-status.use-case.js";
import { CreateTicketUseCase } from "#/modules/tickets/application/create-ticket.use-case.js";
import { GetTicketByIdUseCase } from "#/modules/tickets/application/get-ticket-by-id.use-case.js";
import { ListTicketsUseCase } from "#/modules/tickets/application/list-tickets.use-case.js";
import {
  ticketPriorities,
  ticketStatuses,
} from "#/modules/tickets/domain/ticket.js";
import { DrizzleTicketRepository } from "#/modules/tickets/infrastructure/drizzle-ticket.repository.js";
import { DrizzleUserLookupRepository } from "#/modules/users/infrastructure/drizzle-user-lookup.repository.js";
import { db } from "#/shared/db/client.js";
import { requireAuthenticatedUser } from "#/shared/http/auth.js";

const createTicketBodySchema = z
  .object({
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

const ticketIdParamsSchema = z.object({ id: z.uuid() }).strict();

const assignTicketBodySchema = z
  .object({
    assignedTo: z.uuid(),
  })
  .strict();

const changeTicketStatusBodySchema = z
  .object({
    status: z.enum(ticketStatuses),
  })
  .strict();

export function ticketRoutes(app: FastifyInstance): void {
  const userLookup = new DrizzleUserLookupRepository(db);
  const ticketRepository = new DrizzleTicketRepository(db);
  const createTicketUseCase = new CreateTicketUseCase(ticketRepository);
  const listTicketsUseCase = new ListTicketsUseCase(ticketRepository);
  const getTicketByIdUseCase = new GetTicketByIdUseCase(ticketRepository);
  const assignTicketUseCase = new AssignTicketUseCase(
    ticketRepository,
    userLookup,
  );
  const changeTicketStatusUseCase = new ChangeTicketStatusUseCase(
    ticketRepository,
    userLookup,
  );

  app.post("/tickets", async (request, reply) => {
    const authenticatedUser = requireAuthenticatedUser(request);
    const body = createTicketBodySchema.parse(request.body);
    const input: CreateTicketInput = {
      createdBy: authenticatedUser.sub,
      description: body.description,
      ...(body.priority === undefined ? {} : { priority: body.priority }),
      title: body.title,
    };
    const ticket = await createTicketUseCase.execute(input);

    return reply.code(201).send({ data: ticket });
  });

  app.get("/tickets", async (request) => {
    requireAuthenticatedUser(request);
    const query = listTicketsQuerySchema.parse(request.query);
    const filters: ListTicketsFilters = {
      ...(query.priority === undefined ? {} : { priority: query.priority }),
      ...(query.status === undefined ? {} : { status: query.status }),
    };
    const tickets = await listTicketsUseCase.execute(filters);

    return { data: tickets };
  });

  app.get("/tickets/:id", async (request) => {
    requireAuthenticatedUser(request);
    const params = ticketIdParamsSchema.parse(request.params);
    const input: GetTicketByIdInput = { id: params.id };
    const ticket = await getTicketByIdUseCase.execute(input);

    return { data: ticket };
  });

  app.patch("/tickets/:id/assign", async (request) => {
    const authenticatedUser = requireAuthenticatedUser(request);
    const params = ticketIdParamsSchema.parse(request.params);
    const body = assignTicketBodySchema.parse(request.body);
    const input: AssignTicketInput = {
      actorId: authenticatedUser.sub,
      assignedTo: body.assignedTo,
      ticketId: params.id,
    };
    const ticket = await assignTicketUseCase.execute(input);

    return { data: ticket };
  });

  app.patch("/tickets/:id/status", async (request) => {
    const authenticatedUser = requireAuthenticatedUser(request);
    const params = ticketIdParamsSchema.parse(request.params);
    const body = changeTicketStatusBodySchema.parse(request.body);

    const ticket = await changeTicketStatusUseCase.execute({
      actorId: authenticatedUser.sub,
      status: body.status,
      ticketId: params.id,
    });

    return { data: ticket };
  });
}
