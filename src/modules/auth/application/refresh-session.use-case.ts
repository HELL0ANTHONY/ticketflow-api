import type {
  AuthSession,
  RefreshSessionInput,
} from "#/modules/auth/domain/auth.js";
import type { UserAuthLookup } from "#/modules/users/application/ports/user-auth-lookup.js";

import { UnauthorizedError } from "#/shared/errors/application-error.js";
import { hashRefreshToken } from "#/shared/security/refresh-token.js";

import type { AuthRepository } from "./ports/auth-repository.js";

import { createAuthSession } from "./auth-session.factory.js";

export class RefreshSessionUseCase {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly userAuthLookup: UserAuthLookup,
  ) {}

  async execute(input: RefreshSessionInput): Promise<AuthSession> {
    const refreshTokenHash = hashRefreshToken(input.refreshToken);
    const refreshToken =
      await this.authRepository.findRefreshTokenByHash(refreshTokenHash);

    if (refreshToken === undefined) {
      throw new UnauthorizedError("Invalid refresh token");
    }

    if (refreshToken.revokedAt !== null) {
      await this.authRepository.revokeAllRefreshTokensForUser(
        refreshToken.userId,
      );
      throw new UnauthorizedError("Invalid refresh token");
    }

    if (refreshToken.expiresAt <= new Date()) {
      await this.authRepository.revokeRefreshToken(refreshToken.id);
      throw new UnauthorizedError("Invalid refresh token");
    }

    const user = await this.userAuthLookup.findUserById(refreshToken.userId);

    if (user === undefined) {
      throw new UnauthorizedError("Invalid refresh token");
    }

    await this.authRepository.revokeRefreshToken(refreshToken.id);

    return createAuthSession(this.authRepository, user);
  }
}
