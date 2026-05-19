import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { and, desc, eq } from "drizzle-orm";
import { DatabaseError } from "pg";

import type { UserRepository } from "#/modules/users/application/ports/user-repository.js";
import type {
  CreateUserInput,
  GetUserByIdInput,
  ListUsersFilters,
  User,
} from "#/modules/users/domain/user.js";
import type * as databaseSchema from "#/shared/db/schema.js";

import { users } from "#/shared/db/schema.js";
import { ConflictError } from "#/shared/errors/application-error.js";

type Database = NodePgDatabase<typeof databaseSchema>;

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly database: Database) {}

  async create(input: CreateUserInput): Promise<User> {
    try {
      return await this.database.transaction(async (transaction) => {
        const [user] = await transaction
          .insert(users)
          .values({
            email: input.email,
            name: input.name,
            passwordHash: input.password,
            ...(input.role === undefined ? {} : { role: input.role }),
          })
          .returning();

        if (user === undefined) {
          throw new Error("User insert did not return a row");
        }

        return user;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
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

const PG_UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown): boolean {
  return error instanceof DatabaseError && error.code === PG_UNIQUE_VIOLATION;
}
