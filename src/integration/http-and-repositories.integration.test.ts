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

import type { DrizzleAuthRepository as DrizzleAuthRepositoryInstance } from "#/modules/auth/infrastructure/drizzle-auth.repository.js";
import type { DrizzleCommentRepository as DrizzleCommentRepositoryInstance } from "#/modules/comments/infrastructure/drizzle-comment.repository.js";
import type { DrizzleTicketRepository as DrizzleTicketRepositoryInstance } from "#/modules/tickets/infrastructure/drizzle-ticket.repository.js";
import type { User, UserRole } from "#/modules/users/domain/user.js";
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

let DrizzleAuthRepository: RepositoryConstructor<DrizzleAuthRepositoryInstance>;
let DrizzleCommentRepository: RepositoryConstructor<DrizzleCommentRepositoryInstance>;
let DrizzleTicketRepository: RepositoryConstructor<DrizzleTicketRepositoryInstance>;
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

  ({ DrizzleAuthRepository } = await import(
    "#/modules/auth/infrastructure/drizzle-auth.repository.js"
  ));
  ({ DrizzleCommentRepository } = await import(
    "#/modules/comments/infrastructure/drizzle-comment.repository.js"
  ));
  ({ DrizzleTicketRepository } = await import(
    "#/modules/tickets/infrastructure/drizzle-ticket.repository.js"
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

function parseData(body: string): unknown {
  return (JSON.parse(body) as DataResponse<unknown>).data;
}
