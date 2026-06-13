import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import type { AuditRepository } from "#/modules/audit/application/ports/audit-repository.js";
import type {
  AuditEvent,
  ListAuditEventsFilters,
} from "#/modules/audit/domain/audit-event.js";
import type { TicketLookup } from "#/modules/tickets/application/ports/ticket-lookup.js";
import type { TicketSummary } from "#/modules/tickets/domain/ticket.js";

import {
  NotFoundError,
  ValidationError,
} from "#/shared/errors/application-error.js";

import { ListAuditEventsUseCase } from "./list-audit-events.use-case.js";
import { ListTicketAuditEventsUseCase } from "./list-ticket-audit-events.use-case.js";

class InMemoryAuditRepository implements AuditRepository {
  readonly listCalls: ListAuditEventsFilters[] = [];

  constructor(private readonly events: AuditEvent[]) {}

  list(filters: ListAuditEventsFilters): Promise<AuditEvent[]> {
    this.listCalls.push(filters);

    return Promise.resolve(
      this.events.filter((event) => {
        const matchesTicket =
          filters.ticketId === undefined || event.ticketId === filters.ticketId;
        const matchesActor =
          filters.actorId === undefined || event.actorId === filters.actorId;
        const matchesType =
          filters.eventType === undefined ||
          event.eventType === filters.eventType;
        const matchesFrom =
          filters.from === undefined || event.createdAt >= filters.from;
        const matchesTo =
          filters.to === undefined || event.createdAt <= filters.to;

        return (
          matchesTicket &&
          matchesActor &&
          matchesType &&
          matchesFrom &&
          matchesTo
        );
      }),
    );
  }
}

class InMemoryTicketLookup implements TicketLookup {
  constructor(private readonly tickets: TicketSummary[]) {}

  findTicketSummaryById(id: string): Promise<TicketSummary | undefined> {
    return Promise.resolve(this.tickets.find((ticket) => ticket.id === id));
  }
}

function makeAuditEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    actorId: faker.string.uuid(),
    createdAt: faker.date.recent(),
    eventType: "ticket_created",
    id: faker.string.uuid(),
    metadata: {},
    ticketId: faker.string.uuid(),
    ...overrides,
  };
}

describe("audit use cases", () => {
  it("lists audit events with filters", async () => {
    const actorId = faker.string.uuid();
    const ticketId = faker.string.uuid();
    const matchingEvent = makeAuditEvent({
      actorId,
      createdAt: new Date("2026-01-10T00:00:00.000Z"),
      eventType: "ticket_assigned",
      ticketId,
    });
    const repository = new InMemoryAuditRepository([
      matchingEvent,
      makeAuditEvent({ actorId }),
      makeAuditEvent({ ticketId }),
    ]);
    const useCase = new ListAuditEventsUseCase(repository);
    const filters = {
      actorId,
      eventType: "ticket_assigned" as const,
      from: new Date("2026-01-01T00:00:00.000Z"),
      ticketId,
      to: new Date("2026-01-31T00:00:00.000Z"),
    };

    const result = await useCase.execute(filters);

    expect(repository.listCalls).toEqual([filters]);
    expect(result).toEqual([matchingEvent]);
  });

  it("rejects inverted audit date ranges", async () => {
    const repository = new InMemoryAuditRepository([]);
    const useCase = new ListAuditEventsUseCase(repository);

    await expect(
      useCase.execute({
        from: new Date("2026-02-01T00:00:00.000Z"),
        to: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ).rejects.toThrow(ValidationError);

    expect(repository.listCalls).toEqual([]);
  });

  it("lists audit events for an existing ticket", async () => {
    const ticketId = faker.string.uuid();
    const event = makeAuditEvent({ ticketId });
    const repository = new InMemoryAuditRepository([event]);
    const useCase = new ListTicketAuditEventsUseCase(
      repository,
      new InMemoryTicketLookup([{ id: ticketId }]),
    );

    const result = await useCase.execute({ ticketId });

    expect(repository.listCalls).toEqual([{ ticketId }]);
    expect(result).toEqual([event]);
  });

  it("throws when listing audit events for a missing ticket", async () => {
    const repository = new InMemoryAuditRepository([]);
    const useCase = new ListTicketAuditEventsUseCase(
      repository,
      new InMemoryTicketLookup([]),
    );

    await expect(
      useCase.execute({ ticketId: faker.string.uuid() }),
    ).rejects.toThrow(NotFoundError);

    expect(repository.listCalls).toEqual([]);
  });
});
