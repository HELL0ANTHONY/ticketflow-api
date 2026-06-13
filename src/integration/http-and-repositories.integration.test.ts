import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { FastifyInstance } from "fastify";

import { faker } from "@faker-js/faker";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import bcrypt from "bcrypt";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { DrizzleAuditRepository as DrizzleAuditRepositoryInstance } from "#/modules/audit/infrastructure/drizzle-audit.repository.js";
import type { DrizzleAuthRepository as DrizzleAuthRepositoryInstance } from "#/modules/auth/infrastructure/drizzle-auth.repository.js";
import type { DrizzleCommentRepository as DrizzleCommentRepositoryInstance } from "#/modules/comments/infrastructure/drizzle-comment.repository.js";
import type { DrizzleTicketLookupRepository as DrizzleTicketLookupRepositoryInstance } from "#/modules/tickets/infrastructure/drizzle-ticket-lookup.repository.js";
import type { DrizzleTicketRepository as DrizzleTicketRepositoryInstance } from "#/modules/tickets/infrastructure/drizzle-ticket.repository.js";
import type { User, UserRole } from "#/modules/users/domain/user.js";
import type { DrizzleUserAuthLookupRepository as DrizzleUserAuthLookupRepositoryInstance } from "#/modules/users/infrastructure/drizzle-user-auth-lookup.repository.js";
import type { DrizzleUserLookupRepository as DrizzleUserLookupRepositoryInstance } from "#/modules/users/infrastructure/drizzle-user-lookup.repository.js";
import type { DrizzleUserRepository as DrizzleUserRepositoryInstance } from "#/modules/users/infrastructure/drizzle-user.repository.js";

import * as schema from "#/shared/db/schema.js";
import { ConflictError } from "#/shared/errors/application-error.js";
import { hashRefreshToken } from "#/shared/security/refresh-token.js";

type Database = NodePgDatabase<typeof schema>;
type RepositoryConstructor<TRepository> = new (
  targetDatabase: Database,
) => TRepository;

type DataResponse<T> = {
  data: T;
};

type AuthSessionResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    email: string;
    id: string;
    name: string;
    role: UserRole;
  };
};

type TicketResponse = {
  assignedTo: null | string;
  createdBy: string;
  description: string;
  id: string;
  priority: string;
  status: string;
  title: string;
};

type CommentResponse = {
  authorId: string;
  id: string;
  ticketId: string;
  visibility: string;
};

type AuditEventResponse = {
  eventType: string;
  ticketId: string;
};

let app: FastifyInstance;
let container: StartedPostgreSqlContainer;
let database: Database;
let pool: Pool;

let DrizzleAuditRepository: RepositoryConstructor<DrizzleAuditRepositoryInstance>;
let DrizzleAuthRepository: RepositoryConstructor<DrizzleAuthRepositoryInstance>;
let DrizzleCommentRepository: RepositoryConstructor<DrizzleCommentRepositoryInstance>;
let DrizzleTicketLookupRepository: RepositoryConstructor<DrizzleTicketLookupRepositoryInstance>;
let DrizzleTicketRepository: RepositoryConstructor<DrizzleTicketRepositoryInstance>;
let DrizzleUserAuthLookupRepository: RepositoryConstructor<DrizzleUserAuthLookupRepositoryInstance>;
let DrizzleUserLookupRepository: RepositoryConstructor<DrizzleUserLookupRepositoryInstance>;
let DrizzleUserRepository: RepositoryConstructor<DrizzleUserRepositoryInstance>;

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:16").start();
  const databaseUrl = container.getConnectionUri();

  process.env["DATABASE_URL"] = databaseUrl;
  process.env["JWT_ACCESS_TOKEN_SECRET"] =
    "ticketflow-integration-test-access-token-secret";
  process.env["LOG_LEVEL"] = "silent";
  process.env["NODE_ENV"] = "test";

  await runMigrations(databaseUrl);

  const dbClient = await import("#/shared/db/client.js");
  database = dbClient.db;
  pool = dbClient.pool;

  ({ DrizzleAuditRepository } = await import(
    "#/modules/audit/infrastructure/drizzle-audit.repository.js"
  ));
  ({ DrizzleAuthRepository } = await import(
    "#/modules/auth/infrastructure/drizzle-auth.repository.js"
  ));
  ({ DrizzleCommentRepository } = await import(
    "#/modules/comments/infrastructure/drizzle-comment.repository.js"
  ));
  ({ DrizzleTicketLookupRepository } = await import(
    "#/modules/tickets/infrastructure/drizzle-ticket-lookup.repository.js"
  ));
  ({ DrizzleTicketRepository } = await import(
    "#/modules/tickets/infrastructure/drizzle-ticket.repository.js"
  ));
  ({ DrizzleUserAuthLookupRepository } = await import(
    "#/modules/users/infrastructure/drizzle-user-auth-lookup.repository.js"
  ));
  ({ DrizzleUserLookupRepository } = await import(
    "#/modules/users/infrastructure/drizzle-user-lookup.repository.js"
  ));
  ({ DrizzleUserRepository } = await import(
    "#/modules/users/infrastructure/drizzle-user.repository.js"
  ));

  const { buildApp } = await import("#/app.js");
  app = buildApp();
  await app.ready();
}, 120_000);

beforeEach(async () => {
  await cleanDatabase(database);
});

afterAll(async () => {
  await app.close();
  await pool.end();
  await container.stop();
}, 30_000);

describe("HTTP integration", () => {
  it("registers a user and returns the current user with the access token", async () => {
    const email = faker.internet.email().toLowerCase();

    const registerResponse = await app.inject({
      method: "POST",
      payload: {
        email,
        name: "Integration User",
        password: "Password123",
      },
      url: "/auth/register",
    });

    expect(registerResponse.statusCode).toBe(201);

    const session = parseData(registerResponse.body) as AuthSessionResponse;
    expect(session.accessToken).toEqual(expect.any(String));
    expect(session.refreshToken).toEqual(expect.any(String));
    expect(session.user).toMatchObject({
      email,
      name: "Integration User",
      role: "customer",
    });
    expect(session.user).not.toHaveProperty("passwordHash");

    const meResponse = await app.inject({
      headers: {
        authorization: `Bearer ${session.accessToken}`,
      },
      method: "GET",
      url: "/me",
    });

    expect(meResponse.statusCode).toBe(200);
    expect(parseData(meResponse.body) as User).toMatchObject({
      email,
      id: session.user.id,
      role: "customer",
    });
  });

  it("rejects protected routes without an access token", async () => {
    const response = await app.inject({
      method: "POST",
      payload: {
        description: "Missing token should fail",
        title: "Missing token",
      },
      url: "/tickets",
    });

    expect(response.statusCode).toBe(401);
  });

  it("returns validation errors for invalid request payloads", async () => {
    const response = await app.inject({
      method: "POST",
      payload: {
        email: "not-an-email",
        name: "Bad",
        password: "short",
        unexpected: true,
      },
      url: "/auth/register",
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toMatchObject({
      error: "validation_error",
      message: "Invalid request payload",
    });
  });

  it("rotates refresh tokens and rejects reuse through HTTP", async () => {
    const email = faker.internet.email().toLowerCase();
    const registerResponse = await app.inject({
      method: "POST",
      payload: {
        email,
        name: "Refresh User",
        password: "Password123",
      },
      url: "/auth/register",
    });
    const initialSession = parseData(registerResponse.body) as AuthSessionResponse;

    const refreshResponse = await app.inject({
      method: "POST",
      payload: {
        refreshToken: initialSession.refreshToken,
      },
      url: "/auth/refresh",
    });

    expect(refreshResponse.statusCode).toBe(200);
    const refreshedSession = parseData(refreshResponse.body) as AuthSessionResponse;
    expect(refreshedSession.refreshToken).not.toBe(initialSession.refreshToken);

    const reusedRefreshResponse = await app.inject({
      method: "POST",
      payload: {
        refreshToken: initialSession.refreshToken,
      },
      url: "/auth/refresh",
    });

    expect(reusedRefreshResponse.statusCode).toBe(401);

    const revokedSessionResponse = await app.inject({
      method: "POST",
      payload: {
        refreshToken: refreshedSession.refreshToken,
      },
      url: "/auth/refresh",
    });

    expect(revokedSessionResponse.statusCode).toBe(401);
  });

  it("revokes one session and all sessions through HTTP logout endpoints", async () => {
    const email = faker.internet.email().toLowerCase();
    const registerResponse = await app.inject({
      method: "POST",
      payload: {
        email,
        name: "Logout User",
        password: "Password123",
      },
      url: "/auth/register",
    });
    const firstSession = parseData(registerResponse.body) as AuthSessionResponse;

    const loginResponse = await app.inject({
      method: "POST",
      payload: {
        email,
        password: "Password123",
      },
      url: "/auth/login",
    });
    const secondSession = parseData(loginResponse.body) as AuthSessionResponse;

    const logoutResponse = await app.inject({
      method: "POST",
      payload: {
        refreshToken: firstSession.refreshToken,
      },
      url: "/auth/logout",
    });

    expect(logoutResponse.statusCode).toBe(204);

    const loggedOutRefreshResponse = await app.inject({
      method: "POST",
      payload: {
        refreshToken: firstSession.refreshToken,
      },
      url: "/auth/refresh",
    });

    expect(loggedOutRefreshResponse.statusCode).toBe(401);

    const logoutAllResponse = await app.inject({
      headers: authHeaders(secondSession.accessToken),
      method: "POST",
      url: "/auth/logout-all",
    });

    expect(logoutAllResponse.statusCode).toBe(204);

    const revokedRefreshResponse = await app.inject({
      method: "POST",
      payload: {
        refreshToken: secondSession.refreshToken,
      },
      url: "/auth/refresh",
    });

    expect(revokedRefreshResponse.statusCode).toBe(401);
  });

  it("enforces user and audit permissions through HTTP", async () => {
    const admin = await seedUser(database, "admin");
    const customer = await seedUser(database, "customer");
    const adminToken = await login(admin.email);
    const customerToken = await login(customer.email);

    const forbiddenUsersResponse = await app.inject({
      headers: authHeaders(customerToken),
      method: "GET",
      url: "/users",
    });

    expect(forbiddenUsersResponse.statusCode).toBe(403);

    const usersResponse = await app.inject({
      headers: authHeaders(adminToken),
      method: "GET",
      url: "/users?role=customer",
    });

    expect(usersResponse.statusCode).toBe(200);
    expect((parseData(usersResponse.body) as User[]).map((user) => user.id)).toEqual(
      [customer.id],
    );

    const changeRoleResponse = await app.inject({
      headers: authHeaders(adminToken),
      method: "PATCH",
      payload: {
        role: "agent",
      },
      url: `/users/${customer.id}/role`,
    });

    expect(changeRoleResponse.statusCode).toBe(200);
    expect(parseData(changeRoleResponse.body) as User).toMatchObject({
      id: customer.id,
      role: "agent",
    });

    const forbiddenAuditResponse = await app.inject({
      headers: authHeaders(customerToken),
      method: "GET",
      url: "/audit/events",
    });

    expect(forbiddenAuditResponse.statusCode).toBe(403);
  });

  it("runs the main ticket workflow through HTTP", async () => {
    const customer = await seedUser(database, "customer");
    const agent = await seedUser(database, "agent");
    const customerToken = await login(customer.email);
    const agentToken = await login(agent.email);

    const createTicketResponse = await app.inject({
      headers: {
        authorization: `Bearer ${customerToken}`,
      },
      method: "POST",
      payload: {
        description: "The customer cannot sign in.",
        priority: "high",
        title: "Login is broken",
      },
      url: "/tickets",
    });

    expect(createTicketResponse.statusCode).toBe(201);

    const ticket = parseData(createTicketResponse.body) as TicketResponse;
    expect(ticket).toMatchObject({
      createdBy: customer.id,
      priority: "high",
      status: "open",
      title: "Login is broken",
    });

    const forbiddenCommentResponse = await app.inject({
      headers: {
        authorization: `Bearer ${customerToken}`,
      },
      method: "POST",
      payload: {
        body: "Customer should not create internal notes.",
        visibility: "internal",
      },
      url: `/tickets/${ticket.id}/comments`,
    });

    expect(forbiddenCommentResponse.statusCode).toBe(403);

    const assignTicketResponse = await app.inject({
      headers: {
        authorization: `Bearer ${agentToken}`,
      },
      method: "PATCH",
      payload: {
        assignedTo: agent.id,
      },
      url: `/tickets/${ticket.id}/assign`,
    });

    expect(assignTicketResponse.statusCode).toBe(200);
    expect(parseData(assignTicketResponse.body) as TicketResponse).toMatchObject({
      assignedTo: agent.id,
      status: "assigned",
    });

    const changeStatusResponse = await app.inject({
      headers: {
        authorization: `Bearer ${agentToken}`,
      },
      method: "PATCH",
      payload: {
        status: "in_progress",
      },
      url: `/tickets/${ticket.id}/status`,
    });

    expect(changeStatusResponse.statusCode).toBe(200);
    expect((parseData(changeStatusResponse.body) as TicketResponse).status).toBe(
      "in_progress",
    );

    const internalCommentResponse = await app.inject({
      headers: {
        authorization: `Bearer ${agentToken}`,
      },
      method: "POST",
      payload: {
        body: "Agent internal note.",
        visibility: "internal",
      },
      url: `/tickets/${ticket.id}/comments`,
    });

    expect(internalCommentResponse.statusCode).toBe(201);
    expect(
      parseData(internalCommentResponse.body) as CommentResponse,
    ).toMatchObject({
      authorId: agent.id,
      ticketId: ticket.id,
      visibility: "internal",
    });

    const eventsResponse = await app.inject({
      headers: {
        authorization: `Bearer ${agentToken}`,
      },
      method: "GET",
      url: `/tickets/${ticket.id}/events`,
    });

    expect(eventsResponse.statusCode).toBe(200);
    expect(
      (parseData(eventsResponse.body) as AuditEventResponse[]).map(
        (event) => event.eventType,
      ),
    ).toEqual(
      expect.arrayContaining([
        "comment_added",
        "ticket_assigned",
        "ticket_created",
        "ticket_status_changed",
      ]),
    );
  });

  it("lists tickets, comments and audit events with HTTP filters", async () => {
    const admin = await seedUser(database, "admin");
    const customer = await seedUser(database, "customer");
    const agent = await seedUser(database, "agent");
    const adminToken = await login(admin.email);
    const customerToken = await login(customer.email);
    const agentToken = await login(agent.email);

    const highTicketResponse = await app.inject({
      headers: authHeaders(customerToken),
      method: "POST",
      payload: {
        description: "High priority ticket",
        priority: "high",
        title: "High priority ticket",
      },
      url: "/tickets",
    });
    const highTicket = parseData(highTicketResponse.body) as TicketResponse;

    await app.inject({
      headers: authHeaders(customerToken),
      method: "POST",
      payload: {
        description: "Low priority ticket",
        priority: "low",
        title: "Low priority ticket",
      },
      url: "/tickets",
    });

    const assignResponse = await app.inject({
      headers: authHeaders(agentToken),
      method: "PATCH",
      payload: {
        assignedTo: agent.id,
      },
      url: `/tickets/${highTicket.id}/assign`,
    });
    expect(assignResponse.statusCode).toBe(200);

    await app.inject({
      headers: authHeaders(customerToken),
      method: "POST",
      payload: {
        body: "Customer visible comment",
      },
      url: `/tickets/${highTicket.id}/comments`,
    });
    await app.inject({
      headers: authHeaders(agentToken),
      method: "POST",
      payload: {
        body: "Internal support note",
        visibility: "internal",
      },
      url: `/tickets/${highTicket.id}/comments`,
    });

    const ticketResponse = await app.inject({
      headers: authHeaders(customerToken),
      method: "GET",
      url: `/tickets/${highTicket.id}`,
    });
    expect(ticketResponse.statusCode).toBe(200);
    expect(parseData(ticketResponse.body) as TicketResponse).toMatchObject({
      id: highTicket.id,
      priority: "high",
      status: "assigned",
    });

    const filteredTicketsResponse = await app.inject({
      headers: authHeaders(customerToken),
      method: "GET",
      url: "/tickets?priority=high&status=assigned",
    });
    expect(filteredTicketsResponse.statusCode).toBe(200);
    expect(
      (parseData(filteredTicketsResponse.body) as TicketResponse[]).map(
        (ticket) => ticket.id,
      ),
    ).toEqual([highTicket.id]);

    const customerCommentsResponse = await app.inject({
      headers: authHeaders(customerToken),
      method: "GET",
      url: `/tickets/${highTicket.id}/comments`,
    });
    expect(customerCommentsResponse.statusCode).toBe(200);
    expect(
      (parseData(customerCommentsResponse.body) as CommentResponse[]).map(
        (comment) => comment.visibility,
      ),
    ).toEqual(["public"]);

    const agentCommentsResponse = await app.inject({
      headers: authHeaders(agentToken),
      method: "GET",
      url: `/tickets/${highTicket.id}/comments`,
    });
    expect(agentCommentsResponse.statusCode).toBe(200);
    expect(
      (parseData(agentCommentsResponse.body) as CommentResponse[]).map(
        (comment) => comment.visibility,
      ),
    ).toEqual(["public", "internal"]);

    const auditResponse = await app.inject({
      headers: authHeaders(adminToken),
      method: "GET",
      url: `/audit/events?ticketId=${highTicket.id}&eventType=comment_added`,
    });
    expect(auditResponse.statusCode).toBe(200);
    expect(parseData(auditResponse.body) as AuditEventResponse[]).toHaveLength(2);
  });
});

describe("Drizzle repository integration", () => {
  it("persists users and maps duplicate email conflicts", async () => {
    const repository = new DrizzleUserRepository(database);
    const email = faker.internet.email().toLowerCase();

    const user = await repository.create({
      email,
      name: "Repository User",
      passwordHash: "hashed-password",
    });

    expect(user).toMatchObject({
      email,
      name: "Repository User",
      role: "customer",
    });

    await expect(
      repository.create({
        email,
        name: "Duplicate User",
        passwordHash: "hashed-password",
      }),
    ).rejects.toThrow(ConflictError);
  });

  it("finds, lists and updates users through repositories and lookups", async () => {
    const repository = new DrizzleUserRepository(database);
    const userLookup = new DrizzleUserLookupRepository(database);
    const userAuthLookup = new DrizzleUserAuthLookupRepository(database);
    const customer = await seedUser(database, "customer");
    const agent = await seedUser(database, "agent");

    await expect(repository.findById({ id: customer.id })).resolves.toMatchObject({
      email: customer.email,
      id: customer.id,
    });
    await expect(userAuthLookup.findUserByEmail(agent.email)).resolves.toMatchObject({
      id: agent.id,
      role: "agent",
    });
    await expect(userLookup.findUserSummaryById(agent.id)).resolves.toEqual({
      id: agent.id,
      role: "agent",
    });

    const users = await repository.list({ role: "customer" });
    expect(users.map((user) => user.id)).toEqual([customer.id]);

    await expect(
      repository.changeRole({
        actorId: agent.id,
        role: "admin",
        userId: customer.id,
      }),
    ).resolves.toMatchObject({
      id: customer.id,
      role: "admin",
    });

    await expect(
      userAuthLookup.findUserById(faker.string.uuid()),
    ).resolves.toBeUndefined();
  });

  it("persists tickets and audit events", async () => {
    const creator = await seedUser(database, "customer");
    const agent = await seedUser(database, "agent");
    const repository = new DrizzleTicketRepository(database);

    const ticket = await repository.create({
      createdBy: creator.id,
      description: "Repository ticket",
      priority: "critical",
      title: "Repository ticket",
    });

    expect(ticket).toMatchObject({
      createdBy: creator.id,
      priority: "critical",
      status: "open",
    });

    const assignedTicket = await repository.assign({
      actorId: agent.id,
      assignedTo: agent.id,
      ticketId: ticket.id,
    });

    expect(assignedTicket).toMatchObject({
      assignedTo: agent.id,
      status: "assigned",
    });

    const events = await database.query.ticketEvents.findMany();
    expect(events.map((event) => event.eventType)).toEqual(
      expect.arrayContaining(["ticket_assigned", "ticket_created"]),
    );
  });

  it("finds, filters and changes tickets through repositories and lookups", async () => {
    const creator = await seedUser(database, "customer");
    const agent = await seedUser(database, "agent");
    const repository = new DrizzleTicketRepository(database);
    const ticketLookup = new DrizzleTicketLookupRepository(database);
    const highTicket = await repository.create({
      createdBy: creator.id,
      description: "High repository ticket",
      priority: "high",
      title: "High repository ticket",
    });
    await repository.create({
      createdBy: creator.id,
      description: "Low repository ticket",
      priority: "low",
      title: "Low repository ticket",
    });

    await expect(repository.findById({ id: highTicket.id })).resolves.toMatchObject({
      id: highTicket.id,
      priority: "high",
    });
    await expect(ticketLookup.findTicketSummaryById(highTicket.id)).resolves.toEqual({
      id: highTicket.id,
    });

    const filteredTickets = await repository.list({
      priority: "high",
      status: "open",
    });
    expect(filteredTickets.map((ticket) => ticket.id)).toEqual([highTicket.id]);

    const closedTicket = await repository.changeStatus({
      actorId: agent.id,
      status: "closed",
      ticketId: highTicket.id,
    });

    expect(closedTicket).toMatchObject({
      id: highTicket.id,
      status: "closed",
    });
    expect(closedTicket.closedAt).toBeInstanceOf(Date);

    await expect(
      ticketLookup.findTicketSummaryById(faker.string.uuid()),
    ).resolves.toBeUndefined();
  });

  it("persists comments and filters internal visibility", async () => {
    const creator = await seedUser(database, "customer");
    const agent = await seedUser(database, "agent");
    const ticketRepository = new DrizzleTicketRepository(database);
    const commentRepository = new DrizzleCommentRepository(database);
    const ticket = await ticketRepository.create({
      createdBy: creator.id,
      description: "Repository comment ticket",
      title: "Repository comment ticket",
    });

    const publicComment = await commentRepository.create({
      authorId: creator.id,
      body: "Public comment",
      ticketId: ticket.id,
      visibility: "public",
    });
    await commentRepository.create({
      authorId: agent.id,
      body: "Internal comment",
      ticketId: ticket.id,
      visibility: "internal",
    });

    await expect(
      commentRepository.listByTicketId({
        includeInternal: false,
        ticketId: ticket.id,
      }),
    ).resolves.toEqual([publicComment]);

    await expect(
      commentRepository.listByTicketId({
        includeInternal: true,
        ticketId: ticket.id,
      }),
    ).resolves.toHaveLength(2);
  });

  it("stores, finds and revokes refresh tokens", async () => {
    const user = await seedUser(database, "customer");
    const repository = new DrizzleAuthRepository(database);
    const refreshToken = "repository-refresh-token";
    const tokenHash = hashRefreshToken(refreshToken);

    await repository.createRefreshToken({
      expiresAt: new Date(Date.now() + 60_000),
      tokenHash,
      userId: user.id,
    });

    const activeToken = await repository.findActiveRefreshTokenByHash(tokenHash);
    expect(activeToken).toMatchObject({
      tokenHash,
      userId: user.id,
    });

    if (activeToken === undefined) {
      throw new Error("Expected active token");
    }

    await repository.revokeRefreshToken(activeToken.id);

    await expect(
      repository.findActiveRefreshTokenByHash(tokenHash),
    ).resolves.toBeUndefined();
    await expect(repository.findRefreshTokenByHash(tokenHash)).resolves.toMatchObject({
      id: activeToken.id,
      userId: user.id,
    });
  });

  it("excludes expired tokens and revokes all active tokens for a user", async () => {
    const user = await seedUser(database, "customer");
    const repository = new DrizzleAuthRepository(database);
    const activeTokenHash = hashRefreshToken("active-refresh-token");
    const expiredTokenHash = hashRefreshToken("expired-refresh-token");

    await repository.createRefreshToken({
      expiresAt: new Date(Date.now() + 60_000),
      tokenHash: activeTokenHash,
      userId: user.id,
    });
    await repository.createRefreshToken({
      expiresAt: new Date(Date.now() - 60_000),
      tokenHash: expiredTokenHash,
      userId: user.id,
    });

    await expect(
      repository.findActiveRefreshTokenByHash(activeTokenHash),
    ).resolves.toMatchObject({
      tokenHash: activeTokenHash,
    });
    await expect(
      repository.findActiveRefreshTokenByHash(expiredTokenHash),
    ).resolves.toBeUndefined();

    await repository.revokeAllRefreshTokensForUser(user.id);

    await expect(
      repository.findActiveRefreshTokenByHash(activeTokenHash),
    ).resolves.toBeUndefined();
    await expect(repository.findRefreshTokenByHash(activeTokenHash)).resolves.toEqual(
      expect.objectContaining({
        revokedAt: expect.any(Date) as Date,
      }),
    );
  });

  it("filters audit events by ticket, actor, type and date range", async () => {
    const creator = await seedUser(database, "customer");
    const agent = await seedUser(database, "agent");
    const ticketRepository = new DrizzleTicketRepository(database);
    const auditRepository = new DrizzleAuditRepository(database);
    const ticket = await ticketRepository.create({
      createdBy: creator.id,
      description: "Audit repository ticket",
      title: "Audit repository ticket",
    });
    const from = new Date(Date.now() - 60_000);
    await ticketRepository.assign({
      actorId: agent.id,
      assignedTo: agent.id,
      ticketId: ticket.id,
    });
    const to = new Date(Date.now() + 60_000);

    const events = await auditRepository.list({
      actorId: agent.id,
      eventType: "ticket_assigned",
      from,
      ticketId: ticket.id,
      to,
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      actorId: agent.id,
      eventType: "ticket_assigned",
      ticketId: ticket.id,
    });
  });
});

async function runMigrations(databaseUrl: string): Promise<void> {
  const migrationPool = new Pool({ connectionString: databaseUrl });
  const migrationDatabase = drizzle(migrationPool, { schema });

  try {
    await migrate(migrationDatabase, {
      migrationsFolder: "drizzle",
    });
  } finally {
    await migrationPool.end();
  }
}

async function cleanDatabase(targetDatabase: Database): Promise<void> {
  await targetDatabase.delete(schema.refreshTokens);
  await targetDatabase.delete(schema.ticketEvents);
  await targetDatabase.delete(schema.ticketComments);
  await targetDatabase.delete(schema.tickets);
  await targetDatabase.delete(schema.users);
}

async function seedUser(
  targetDatabase: Database,
  role: UserRole,
): Promise<User> {
  const [user] = await targetDatabase
    .insert(schema.users)
    .values({
      email: faker.internet.email().toLowerCase(),
      name: faker.person.fullName(),
      passwordHash: await bcrypt.hash("Password123", 10),
      role,
    })
    .returning();

  if (user === undefined) {
    throw new Error("User seed did not return a row");
  }

  return user;
}

async function login(email: string): Promise<string> {
  const response = await app.inject({
    method: "POST",
    payload: {
      email,
      password: "Password123",
    },
    url: "/auth/login",
  });

  expect(response.statusCode).toBe(200);

  return (parseData(response.body) as AuthSessionResponse).accessToken;
}

function authHeaders(accessToken: string): { authorization: string } {
  return {
    authorization: `Bearer ${accessToken}`,
  };
}

function parseData(body: string): unknown {
  return (JSON.parse(body) as DataResponse<unknown>).data;
}
