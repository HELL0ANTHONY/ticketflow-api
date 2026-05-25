import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { eq } from "drizzle-orm";

import type { UserAuthLookup } from "#/modules/users/application/ports/user-auth-lookup.js";
import type { User } from "#/modules/users/domain/user.js";
import type * as databaseSchema from "#/shared/db/schema.js";

import { users } from "#/shared/db/schema.js";

type Database = NodePgDatabase<typeof databaseSchema>;

export class DrizzleUserAuthLookupRepository implements UserAuthLookup {
  constructor(private readonly database: Database) {}

  async findUserByEmail(email: string): Promise<User | undefined> {
    return this.database.query.users.findFirst({
      where: eq(users.email, email),
    });
  }

  async findUserById(id: string): Promise<User | undefined> {
    return this.database.query.users.findFirst({
      where: eq(users.id, id),
    });
  }
}
