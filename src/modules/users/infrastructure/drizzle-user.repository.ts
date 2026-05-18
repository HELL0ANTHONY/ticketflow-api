import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { eq } from "drizzle-orm";

import type { UserRepository } from "#/modules/users/application/ports/user-repository.js";
import type { GetUserByIdInput, User } from "#/modules/users/domain/user.js";
import type * as databaseSchema from "#/shared/db/schema.js";

import { users } from "#/shared/db/schema.js";

type Database = NodePgDatabase<typeof databaseSchema>;

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly database: Database) {}

  async findById(input: GetUserByIdInput): Promise<User | undefined> {
    return this.database.query.users.findFirst({
      where: eq(users.id, input.id),
    });
  }
}
