import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { and, desc, eq } from "drizzle-orm";

import type { UserRepository } from "#/modules/users/application/ports/user-repository.js";
import type {
  ChangeUserRoleInput,
  CreateUserData,
  GetUserByIdInput,
  ListUsersFilters,
  User,
} from "#/modules/users/domain/user.js";
import type * as databaseSchema from "#/shared/db/schema.js";

import {
  isPostgresError,
  postgresErrorCodes,
} from "#/shared/db/postgres-errors.js";
import { users } from "#/shared/db/schema.js";
import { ConflictError } from "#/shared/errors/application-error.js";

type Database = NodePgDatabase<typeof databaseSchema>;

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly database: Database) {}

  async changeRole(input: ChangeUserRoleInput): Promise<User> {
    const [user] = await this.database
      .update(users)
      .set({ role: input.role })
      .where(eq(users.id, input.userId))
      .returning();

    if (user === undefined) {
      throw new Error("User role update did not return a row");
    }

    return user;
  }

  async create(input: CreateUserData): Promise<User> {
    try {
      return await this.database.transaction(async (transaction) => {
        const [user] = await transaction
          .insert(users)
          .values({
            email: input.email,
            name: input.name,
            passwordHash: input.passwordHash,
            ...(input.role === undefined ? {} : { role: input.role }),
          })
          .returning();

        if (user === undefined) {
          throw new Error("User insert did not return a row");
        }

        return user;
      });
    } catch (error) {
      if (isPostgresError(error, postgresErrorCodes.uniqueViolation)) {
        throw new ConflictError("Email already in use");
      }

      throw error;
    }
  }

  async findById(input: GetUserByIdInput): Promise<User | undefined> {
    return this.database.query.users.findFirst({
      where: eq(users.id, input.id),
    });
  }

  async list(filters: ListUsersFilters): Promise<User[]> {
    const conditions = [
      filters.role === undefined ? undefined : eq(users.role, filters.role),
    ].filter(
      (condition): condition is NonNullable<typeof condition> =>
        condition !== undefined,
    );

    const whereCondition =
      conditions.length === 0 ? undefined : and(...conditions);

    return this.database.query.users.findMany({
      orderBy: [desc(users.createdAt)],
      where: whereCondition,
    });
  }
}
