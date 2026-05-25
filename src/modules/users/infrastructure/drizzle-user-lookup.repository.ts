import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { eq } from "drizzle-orm";

import type { UserLookup } from "#/modules/users/application/ports/user-lookup.js";
import type { UserSummary } from "#/modules/users/domain/user.js";
import type * as databaseSchema from "#/shared/db/schema.js";

import { users } from "#/shared/db/schema.js";

type Database = NodePgDatabase<typeof databaseSchema>;

export class DrizzleUserLookupRepository implements UserLookup {
  constructor(private readonly database: Database) {}

  async findUserSummaryById(id: string): Promise<UserSummary | undefined> {
    return this.database.query.users.findFirst({
      columns: {
        id: true,
        role: true,
      },
      where: eq(users.id, id),
    });
  }
}
