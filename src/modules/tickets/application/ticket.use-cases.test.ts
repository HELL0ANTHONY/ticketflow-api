import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import type { TicketRepository } from "#/modules/tickets/application/ports/ticket-repository.js";
import type {
  AssignTicketInput,
  ChangeTicketStatusInput,
  CreateTicketInput,
  ListTicketsFilters,
  Ticket,
} from "#/modules/tickets/domain/ticket.js";
import type { UserLookup } from "#/modules/users/application/ports/user-lookup.js";
import type { UserSummary } from "#/modules/users/domain/user.js";

import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "#/shared/errors/application-error.js";

import { AssignTicketUseCase } from "./assign-ticket.use-case.js";
import { ChangeTicketStatusUseCase } from "./change-ticket-status.use-case.js";
import { CreateTicketUseCase } from "./create-ticket.use-case.js";
import { GetTicketByIdUseCase } from "./get-ticket-by-id.use-case.js";
import { ListTicketsUseCase } from "./list-tickets.use-case.js";

class InMemoryTicketRepository implements TicketRepository {
  readonly assignCalls: AssignTicketInput[] = [];
  readonly changeStatusCalls: ChangeTicketStatusInput[] = [];
  readonly createCalls: CreateTicketInput[] = [];
  readonly listCalls: ListTicketsFilters[] = [];

  constructor(private readonly tickets: Ticket[]) {}

  assign(input: AssignTicketInput): Promise<Ticket> {
    this.assignCalls.push(input);

    const ticket = this.findTicket(input.ticketId);
    ticket.assignedTo = input.assignedTo;
    ticket.status = "assigned";
    ticket.updatedAt = new Date();

    return Promise.resolve(ticket);
  }

  changeStatus(input: ChangeTicketStatusInput): Promise<Ticket> {
    this.changeStatusCalls.push(input);

    const ticket = this.findTicket(input.ticketId);
    ticket.status = input.status;
    ticket.closedAt = input.status === "closed" ? new Date() : ticket.closedAt;
    ticket.updatedAt = new Date();

    return Promise.resolve(ticket);
  }

  create(input: CreateTicketInput): Promise<Ticket> {
    this.createCalls.push(input);

    const ticket = makeTicket({
      createdBy: input.createdBy,
      description: input.description,
      priority: input.priority ?? "medium",
      title: input.title,
    });
    this.tickets.push(ticket);

    return Promise.resolve(ticket);
  }

  findById(input: { id: string }): Promise<Ticket | undefined> {
    return Promise.resolve(this.tickets.find((ticket) => ticket.id === input.id));
  }

  list(filters: ListTicketsFilters): Promise<Ticket[]> {
    this.listCalls.push(filters);

    return Promise.resolve(
      this.tickets.filter((ticket) => {
        const matchesPriority =
          filters.priority === undefined || ticket.priority === filters.priority;
        const matchesStatus =
          filters.status === undefined || ticket.status === filters.status;

        return matchesPriority && matchesStatus;
      }),
    );
  }

  private findTicket(id: string): Ticket {
    const ticket = this.tickets.find((candidate) => candidate.id === id);

    if (ticket === undefined) {
      throw new Error("Ticket not found");
    }

    return ticket;
  }
}

class InMemoryUserLookup implements UserLookup {
  constructor(private readonly users: UserSummary[]) {}

  findUserSummaryById(id: string): Promise<UserSummary | undefined> {
    return Promise.resolve(this.users.find((user) => user.id === id));
  }
}

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  const now = faker.date.recent();

  return {
    assignedTo: null,
    closedAt: null,
    createdAt: now,
    createdBy: faker.string.uuid(),
    description: faker.lorem.paragraph(),
    id: faker.string.uuid(),
    priority: "medium",
    status: "open",
    title: faker.lorem.sentence(),
    updatedAt: now,
    ...overrides,
  };
}

function makeUserSummary(overrides: Partial<UserSummary> = {}): UserSummary {
  return {
    id: faker.string.uuid(),
    role: "agent",
    ...overrides,
  };
}

describe("ticket use cases", () => {
  it("creates tickets through the repository", async () => {
    const repository = new InMemoryTicketRepository([]);
    const useCase = new CreateTicketUseCase(repository);
    const input = {
      createdBy: faker.string.uuid(),
      description: faker.lorem.paragraph(),
      priority: "high" as const,
      title: faker.lorem.sentence(),
    };

    const result = await useCase.execute(input);

    expect(repository.createCalls).toEqual([input]);
    expect(result).toMatchObject({
      createdBy: input.createdBy,
      description: input.description,
      priority: "high",
      status: "open",
      title: input.title,
    });
  });

  it("lists tickets with filters", async () => {
    const matchingTicket = makeTicket({ priority: "critical", status: "open" });
    const repository = new InMemoryTicketRepository([
      matchingTicket,
      makeTicket({ priority: "low", status: "open" }),
      makeTicket({ priority: "critical", status: "resolved" }),
    ]);
    const useCase = new ListTicketsUseCase(repository);

    const result = await useCase.execute({
      priority: "critical",
      status: "open",
    });

    expect(repository.listCalls).toEqual([
      {
        priority: "critical",
        status: "open",
      },
    ]);
    expect(result).toEqual([matchingTicket]);
  });

  it("gets a ticket by id", async () => {
    const ticket = makeTicket();
    const repository = new InMemoryTicketRepository([ticket]);
    const useCase = new GetTicketByIdUseCase(repository);

    await expect(useCase.execute({ id: ticket.id })).resolves.toEqual(ticket);
  });

  it("throws when a ticket does not exist", async () => {
    const repository = new InMemoryTicketRepository([]);
    const useCase = new GetTicketByIdUseCase(repository);

    await expect(useCase.execute({ id: faker.string.uuid() })).rejects.toThrow(
      NotFoundError,
    );
  });

  it("assigns tickets when actor and assignee are allowed", async () => {
    const ticket = makeTicket();
    const actor = makeUserSummary({ role: "agent" });
    const assignee = makeUserSummary({ role: "admin" });
    const repository = new InMemoryTicketRepository([ticket]);
    const useCase = new AssignTicketUseCase(
      repository,
      new InMemoryUserLookup([actor, assignee]),
    );

    const result = await useCase.execute({
      actorId: actor.id,
      assignedTo: assignee.id,
      ticketId: ticket.id,
    });

    expect(repository.assignCalls).toEqual([
      {
        actorId: actor.id,
        assignedTo: assignee.id,
        ticketId: ticket.id,
      },
    ]);
    expect(result).toMatchObject({
      assignedTo: assignee.id,
      id: ticket.id,
      status: "assigned",
    });
  });

  it("does not assign closed tickets", async () => {
    const ticket = makeTicket({ status: "closed" });
    const actor = makeUserSummary({ role: "agent" });
    const assignee = makeUserSummary({ role: "agent" });
    const repository = new InMemoryTicketRepository([ticket]);
    const useCase = new AssignTicketUseCase(
      repository,
      new InMemoryUserLookup([actor, assignee]),
    );

    await expect(
      useCase.execute({
        actorId: actor.id,
        assignedTo: assignee.id,
        ticketId: ticket.id,
      }),
    ).rejects.toThrow(ConflictError);

    expect(repository.assignCalls).toEqual([]);
  });

  it("prevents customers from assigning tickets", async () => {
    const ticket = makeTicket();
    const actor = makeUserSummary({ role: "customer" });
    const assignee = makeUserSummary({ role: "agent" });
    const repository = new InMemoryTicketRepository([ticket]);
    const useCase = new AssignTicketUseCase(
      repository,
      new InMemoryUserLookup([actor, assignee]),
    );

    await expect(
      useCase.execute({
        actorId: actor.id,
        assignedTo: assignee.id,
        ticketId: ticket.id,
      }),
    ).rejects.toThrow(ForbiddenError);

    expect(repository.assignCalls).toEqual([]);
  });

  it("requires assignees to be support users", async () => {
    const ticket = makeTicket();
    const actor = makeUserSummary({ role: "admin" });
    const assignee = makeUserSummary({ role: "customer" });
    const repository = new InMemoryTicketRepository([ticket]);
    const useCase = new AssignTicketUseCase(
      repository,
      new InMemoryUserLookup([actor, assignee]),
    );

    await expect(
      useCase.execute({
        actorId: actor.id,
        assignedTo: assignee.id,
        ticketId: ticket.id,
      }),
    ).rejects.toThrow(ConflictError);

    expect(repository.assignCalls).toEqual([]);
  });

  it("changes ticket status when transition is allowed", async () => {
    const actor = makeUserSummary({ role: "agent" });
    const ticket = makeTicket({
      assignedTo: actor.id,
      status: "assigned",
    });
    const repository = new InMemoryTicketRepository([ticket]);
    const useCase = new ChangeTicketStatusUseCase(
      repository,
      new InMemoryUserLookup([actor]),
    );

    const result = await useCase.execute({
      actorId: actor.id,
      status: "in_progress",
      ticketId: ticket.id,
    });

    expect(repository.changeStatusCalls).toEqual([
      {
        actorId: actor.id,
        status: "in_progress",
        ticketId: ticket.id,
      },
    ]);
    expect(result.status).toBe("in_progress");
  });

  it("rejects invalid status transitions", async () => {
    const actor = makeUserSummary({ role: "agent" });
    const ticket = makeTicket({ status: "open" });
    const repository = new InMemoryTicketRepository([ticket]);
    const useCase = new ChangeTicketStatusUseCase(
      repository,
      new InMemoryUserLookup([actor]),
    );

    await expect(
      useCase.execute({
        actorId: actor.id,
        status: "closed",
        ticketId: ticket.id,
      }),
    ).rejects.toThrow(ConflictError);

    expect(repository.changeStatusCalls).toEqual([]);
  });

  it("requires an assignee before moving to in progress", async () => {
    const actor = makeUserSummary({ role: "admin" });
    const ticket = makeTicket({ status: "assigned" });
    const repository = new InMemoryTicketRepository([ticket]);
    const useCase = new ChangeTicketStatusUseCase(
      repository,
      new InMemoryUserLookup([actor]),
    );

    await expect(
      useCase.execute({
        actorId: actor.id,
        status: "in_progress",
        ticketId: ticket.id,
      }),
    ).rejects.toThrow(ConflictError);

    expect(repository.changeStatusCalls).toEqual([]);
  });
});
