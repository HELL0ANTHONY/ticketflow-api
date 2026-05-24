import type {
  AuthSession,
  RefreshSessionInput,
} from "#/modules/auth/domain/auth.js";

import { UnauthorizedError } from "#/shared/errors/application-error.js";
import { hashRefreshToken } from "#/shared/security/refresh-token.js";

import type { AuthRepository } from "./ports/auth-repository.js";

import { createAuthSession } from "./auth-session.factory.js";

export class RefreshSessionUseCase {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(input: RefreshSessionInput): Promise<AuthSession> {
    const refreshTokenHash = hashRefreshToken(input.refreshToken);
    const refreshToken =
      await this.authRepository.findActiveRefreshTokenByHash(refreshTokenHash);

    if (refreshToken === undefined) {
      throw new UnauthorizedError("Invalid refresh token");
    }

    const user = await this.authRepository.findUserById(refreshToken.userId);

    if (user === undefined) {
      throw new UnauthorizedError("Invalid refresh token");
    }

    await this.authRepository.revokeRefreshToken(refreshToken.id);

    return createAuthSession(this.authRepository, user);
  }
}
