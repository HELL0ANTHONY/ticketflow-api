import type { AuthSession, AuthUser } from "#/modules/auth/domain/auth.js";

import { env } from "#/config/env.js";
import { toPublicUser } from "#/modules/users/domain/user.js";
import { signAccessToken } from "#/shared/security/jwt.js";
import {
  createRefreshToken,
  hashRefreshToken,
} from "#/shared/security/refresh-token.js";

import type { AuthRepository } from "./ports/auth-repository.js";

export async function createAuthSession(
  authRepository: AuthRepository,
  user: AuthUser,
): Promise<AuthSession> {
  const accessToken = signAccessToken({
    email: user.email,
    expiresInSeconds: env.accessTokenExpiresInSeconds,
    name: user.name,
    role: user.role,
    secret: env.jwtAccessTokenSecret,
    userId: user.id,
  });
  const refreshToken = createRefreshToken();

  await authRepository.createRefreshToken({
    expiresAt: getRefreshTokenExpiresAt(),
    tokenHash: hashRefreshToken(refreshToken),
    userId: user.id,
  });

  return {
    accessToken,
    refreshToken,
    user: toPublicUser(user),
  };
}

function getRefreshTokenExpiresAt(): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + env.refreshTokenExpiresInDays);

  return expiresAt;
}
