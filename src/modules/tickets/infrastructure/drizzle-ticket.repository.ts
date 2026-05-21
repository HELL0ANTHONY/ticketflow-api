import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { and, desc, eq } from "drizzle-orm";
import { DatabaseError } from "pg";

import type { TicketRepository } from "#/modules/tickets/application/ports/ticket-repository.js";
import type {
  AssignTicketInput,
  CreateTicketInput,
  GetTicketByIdInput,
  ListTicketsFilters,
  Ticket,
  TicketUserSummary,
} from "#/modules/tickets/domain/ticket.js";
import type * as databaseSchema from "#/shared/db/schema.js";

import { ticketEvents, tickets, users } from "#/shared/db/schema.js";
import {
  ConflictError,
  NotFoundError,
} from "#/shared/errors/application-error.js";

type Database = NodePgDatabase<typeof databaseSchema>;

export class DrizzleTicketRepository implements TicketRepository {
  constructor(private readonly database: Database) {}

  async create(input: CreateTicketInput): Promise<Ticket> {
    try {
      return await this.database.transaction(async (transaction) => {
        const [ticket] = await transaction
          .insert(tickets)
          .values({
            createdBy: input.createdBy,
            description: input.description,
            priority: input.priority,
            title: input.title,
          })
          .returning();

        if (ticket === undefined) {
          throw new Error("Ticket insert did not return a row");
        }

        await transaction.insert(ticketEvents).values({
          actorId: input.createdBy,
          eventType: "ticket_created",
          metadata: {
            priority: ticket.priority,
            title: ticket.title,
          },
          ticketId: ticket.id,
        });

        return ticket;
      });
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictError("createdBy must reference an existing user");
      }

      throw error;
    }
  }

  async list(filters: ListTicketsFilters): Promise<Ticket[]> {
    const conditions = [
      filters.priority === undefined
        ? undefined
        : eq(tickets.priority, filters.priority),
      filters.status === undefined
        ? undefined
        : eq(tickets.status, filters.status),
    ].filter((condition) => condition !== undefined);

    const whereCondition =
      conditions.length === 0 ? undefined : and(...conditions);

    return this.database.query.tickets.findMany({
      orderBy: [desc(tickets.createdAt)],
      where: whereCondition,
    });
  }

  async findById(input: GetTicketByIdInput): Promise<Ticket | undefined> {
    return this.database.query.tickets.findFirst({
      where: eq(tickets.id, input.id),
    });
  }

  async findUserById(id: string): Promise<TicketUserSummary | undefined> {
    return this.database.query.users.findFirst({
      columns: {
        id: true,
        role: true,
      },
      where: eq(users.id, id),
    });
  }

  async assign(input: AssignTicketInput): Promise<Ticket> {
    try {
      return await this.database.transaction(async (transaction) => {
        const currentTicket = await transaction.query.tickets.findFirst({
          where: eq(tickets.id, input.ticketId),
        });

        if (currentTicket === undefined) {
          throw new NotFoundError("Ticket not found");
        }

        const nextStatus =
          currentTicket.status === "open" ? "assigned" : currentTicket.status;
        const updatedAt = new Date();

        const [updatedTicket] = await transaction
          .update(tickets)
          .set({
            assignedTo: input.assignedTo,
            status: nextStatus,
            updatedAt,
          })
          .where(eq(tickets.id, input.ticketId))
          .returning();

        if (updatedTicket === undefined) {
          throw new Error("Ticket assignment did not return a row");
        }

        await transaction.insert(ticketEvents).values({
          actorId: input.actorId,
          eventType: "ticket_assigned",
          metadata: {
            assignedTo: input.assignedTo,
            newStatus: nextStatus,
            previousAssignedTo: currentTicket.assignedTo,
            previousStatus: currentTicket.status,
          },
          ticketId: input.ticketId,
        });

        return updatedTicket;
      });
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictError(
          "actorId and assignedTo must reference existing users",
        );
      }

      throw error;
    }
  }
}

const PG_FOREIGN_KEY_VIOLATION = "23503";

function isForeignKeyViolation(error: unknown): boolean {
  if (error instanceof DatabaseError) {
    return error.code === PG_FOREIGN_KEY_VIOLATION;
  }

  if (error instanceof Error && error.cause !== undefined) {
    return isForeignKeyViolation(error.cause);
  }

  return false;
}
