import type { AuthUser, RefreshTokenRecord } from "#/modules/auth/domain/auth.js";

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
  findUserByEmail(email: string): Promise<AuthUser | undefined>;
  findUserById(id: string): Promise<AuthUser | undefined>;
  revokeRefreshToken(id: string): Promise<void>;
};
