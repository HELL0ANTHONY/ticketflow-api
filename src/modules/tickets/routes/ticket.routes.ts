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

const ticketIdParamsSchema = z.object({ id: z.uuid() }).strict();

const assignTicketBodySchema = z
  .object({
    actorId: z.uuid(),
    assignedTo: z.uuid(),
  })
  .strict();

const changeTicketStatusBodySchema = z
  .object({
    actorId: z.uuid(),
    status: z.enum(ticketStatuses),
  })
  .strict();

export function ticketRoutes(app: FastifyInstance): void {
  const ticketRepository = new DrizzleTicketRepository(db);
  const createTicketUseCase = new CreateTicketUseCase(ticketRepository);
  const listTicketsUseCase = new ListTicketsUseCase(ticketRepository);
  const getTicketByIdUseCase = new GetTicketByIdUseCase(ticketRepository);
  const assignTicketUseCase = new AssignTicketUseCase(ticketRepository);
  const changeTicketStatusUseCase = new ChangeTicketStatusUseCase(
    ticketRepository,
  );

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
    const input: GetTicketByIdInput = { id: params.id };
    const ticket = await getTicketByIdUseCase.execute(input);

    return { data: ticket };
  });

  app.patch("/ticket/:id/assign", async (request) => {
    const params = ticketIdParamsSchema.parse(request.params);
    const body = assignTicketBodySchema.parse(request.body);
    const input: AssignTicketInput = {
      actorId: body.actorId,
      assignedTo: body.assignedTo,
      ticketId: params.id,
    };
    const ticket = await assignTicketUseCase.execute(input);

    return { data: ticket };
  });

  app.patch("/ticket/:id/status", async (request) => {
    const params = ticketIdParamsSchema.parse(request.params);
    const body = changeTicketStatusBodySchema.parse(request.body);

    const ticket = await changeTicketStatusUseCase.execute({
      actorId: body.actorId,
      status: body.status,
      ticketId: params.id,
    });

    return { data: ticket };
  });
}
