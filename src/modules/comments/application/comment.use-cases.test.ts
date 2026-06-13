import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import type { CommentRepository } from "#/modules/comments/application/ports/comment-repository.js";
import type {
  AddCommentData,
  ListCommentsFilters,
  TicketComment,
} from "#/modules/comments/domain/comment.js";
import type { TicketLookup } from "#/modules/tickets/application/ports/ticket-lookup.js";
import type { TicketSummary } from "#/modules/tickets/domain/ticket.js";
import type { UserLookup } from "#/modules/users/application/ports/user-lookup.js";
import type { UserSummary } from "#/modules/users/domain/user.js";

import {
  ForbiddenError,
  NotFoundError,
} from "#/shared/errors/application-error.js";

import { AddCommentUseCase } from "./add-comment.use-case.js";
import { ListCommentsUseCase } from "./list-comments.use-case.js";

class InMemoryCommentRepository implements CommentRepository {
  readonly createCalls: AddCommentData[] = [];
  readonly listCalls: ListCommentsFilters[] = [];

  constructor(private readonly comments: TicketComment[]) {}

  create(input: AddCommentData): Promise<TicketComment> {
    this.createCalls.push(input);

    const comment = makeComment(input);
    this.comments.push(comment);

    return Promise.resolve(comment);
  }

  listByTicketId(filters: ListCommentsFilters): Promise<TicketComment[]> {
    this.listCalls.push(filters);

    return Promise.resolve(
      this.comments.filter(
        (comment) =>
          comment.ticketId === filters.ticketId &&
          (filters.includeInternal || comment.visibility === "public"),
      ),
    );
  }
}

class InMemoryTicketLookup implements TicketLookup {
  constructor(private readonly tickets: TicketSummary[]) {}

  findTicketSummaryById(id: string): Promise<TicketSummary | undefined> {
    return Promise.resolve(this.tickets.find((ticket) => ticket.id === id));
  }
}

class InMemoryUserLookup implements UserLookup {
  constructor(private readonly users: UserSummary[]) {}

  findUserSummaryById(id: string): Promise<UserSummary | undefined> {
    return Promise.resolve(this.users.find((user) => user.id === id));
  }
}

function makeComment(overrides: Partial<TicketComment> = {}): TicketComment {
  return {
    authorId: faker.string.uuid(),
    body: faker.lorem.paragraph(),
    createdAt: faker.date.recent(),
    id: faker.string.uuid(),
    ticketId: faker.string.uuid(),
    visibility: "public",
    ...overrides,
  };
}

function makeTicketSummary(id = faker.string.uuid()): TicketSummary {
  return { id };
}

function makeUserSummary(overrides: Partial<UserSummary> = {}): UserSummary {
  return {
    id: faker.string.uuid(),
    role: "customer",
    ...overrides,
  };
}

describe("comment use cases", () => {
  it("adds public comments by default", async () => {
    const ticket = makeTicketSummary();
    const author = makeUserSummary({ role: "customer" });
    const repository = new InMemoryCommentRepository([]);
    const useCase = new AddCommentUseCase(
      repository,
      new InMemoryTicketLookup([ticket]),
      new InMemoryUserLookup([author]),
    );

    const result = await useCase.execute({
      authorId: author.id,
      body: "This needs help",
      ticketId: ticket.id,
    });

    expect(repository.createCalls).toEqual([
      {
        authorId: author.id,
        body: "This needs help",
        ticketId: ticket.id,
        visibility: "public",
      },
    ]);
    expect(result).toMatchObject({
      authorId: author.id,
      ticketId: ticket.id,
      visibility: "public",
    });
  });

  it("allows support users to add internal comments", async () => {
    const ticket = makeTicketSummary();
    const author = makeUserSummary({ role: "agent" });
    const repository = new InMemoryCommentRepository([]);
    const useCase = new AddCommentUseCase(
      repository,
      new InMemoryTicketLookup([ticket]),
      new InMemoryUserLookup([author]),
    );

    await expect(
      useCase.execute({
        authorId: author.id,
        body: "Internal note",
        ticketId: ticket.id,
        visibility: "internal",
      }),
    ).resolves.toMatchObject({ visibility: "internal" });
  });

  it("prevents customers from adding internal comments", async () => {
    const ticket = makeTicketSummary();
    const author = makeUserSummary({ role: "customer" });
    const repository = new InMemoryCommentRepository([]);
    const useCase = new AddCommentUseCase(
      repository,
      new InMemoryTicketLookup([ticket]),
      new InMemoryUserLookup([author]),
    );

    await expect(
      useCase.execute({
        authorId: author.id,
        body: "Internal note",
        ticketId: ticket.id,
        visibility: "internal",
      }),
    ).rejects.toThrow(ForbiddenError);

    expect(repository.createCalls).toEqual([]);
  });

  it("throws when adding a comment to a missing ticket", async () => {
    const author = makeUserSummary();
    const repository = new InMemoryCommentRepository([]);
    const useCase = new AddCommentUseCase(
      repository,
      new InMemoryTicketLookup([]),
      new InMemoryUserLookup([author]),
    );

    await expect(
      useCase.execute({
        authorId: author.id,
        body: "Missing ticket",
        ticketId: faker.string.uuid(),
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("lists internal comments for support users", async () => {
    const ticket = makeTicketSummary();
    const viewer = makeUserSummary({ role: "admin" });
    const publicComment = makeComment({ ticketId: ticket.id });
    const internalComment = makeComment({
      ticketId: ticket.id,
      visibility: "internal",
    });
    const repository = new InMemoryCommentRepository([
      publicComment,
      internalComment,
    ]);
    const useCase = new ListCommentsUseCase(
      repository,
      new InMemoryTicketLookup([ticket]),
      new InMemoryUserLookup([viewer]),
    );

    const result = await useCase.execute({
      ticketId: ticket.id,
      viewerId: viewer.id,
    });

    expect(repository.listCalls).toEqual([
      {
        includeInternal: true,
        ticketId: ticket.id,
      },
    ]);
    expect(result).toEqual([publicComment, internalComment]);
  });

  it("hides internal comments from customers", async () => {
    const ticket = makeTicketSummary();
    const viewer = makeUserSummary({ role: "customer" });
    const publicComment = makeComment({ ticketId: ticket.id });
    const internalComment = makeComment({
      ticketId: ticket.id,
      visibility: "internal",
    });
    const repository = new InMemoryCommentRepository([
      publicComment,
      internalComment,
    ]);
    const useCase = new ListCommentsUseCase(
      repository,
      new InMemoryTicketLookup([ticket]),
      new InMemoryUserLookup([viewer]),
    );

    const result = await useCase.execute({
      ticketId: ticket.id,
      viewerId: viewer.id,
    });

    expect(repository.listCalls).toEqual([
      {
        includeInternal: false,
        ticketId: ticket.id,
      },
    ]);
    expect(result).toEqual([publicComment]);
  });
});
