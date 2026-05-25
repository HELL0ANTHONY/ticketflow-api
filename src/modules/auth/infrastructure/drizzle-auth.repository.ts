import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { and, eq, gt, isNull } from "drizzle-orm";

import type {
  AuthRepository,
  CreateRefreshTokenInput,
} from "#/modules/auth/application/ports/auth-repository.js";
import type { RefreshTokenRecord } from "#/modules/auth/domain/auth.js";
import type * as databaseSchema from "#/shared/db/schema.js";

import { refreshTokens } from "#/shared/db/schema.js";

type Database = NodePgDatabase<typeof databaseSchema>;

export class DrizzleAuthRepository implements AuthRepository {
  constructor(private readonly database: Database) {}

  async createRefreshToken(input: CreateRefreshTokenInput): Promise<void> {
    await this.database.insert(refreshTokens).values(input);
  }

  async findActiveRefreshTokenByHash(
    tokenHash: string,
  ): Promise<RefreshTokenRecord | undefined> {
    return this.database.query.refreshTokens.findFirst({
      where: and(
        eq(refreshTokens.tokenHash, tokenHash),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, new Date()),
      ),
    });
  }

  async revokeRefreshToken(id: string): Promise<void> {
    await this.database
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, id));
  }
}
