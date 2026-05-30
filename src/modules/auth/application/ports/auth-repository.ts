import type { RefreshTokenRecord } from "#/modules/auth/domain/auth.js";

export type CreateRefreshTokenInput = {
  expiresAt: Date;
  tokenHash: string;
  userId: string;
};

export type AuthRepository = {
  createRefreshToken(input: CreateRefreshTokenInput): Promise<void>;
  findActiveRefreshTokenByHash(
    tokenHash: string,
  ): Promise<RefreshTokenRecord | undefined>;
  findRefreshTokenByHash(
    tokenHash: string,
  ): Promise<RefreshTokenRecord | undefined>;
  revokeAllRefreshTokensForUser(userId: string): Promise<void>;
  revokeRefreshToken(id: string): Promise<void>;
};
