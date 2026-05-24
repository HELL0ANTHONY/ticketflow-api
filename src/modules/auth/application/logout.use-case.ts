import type { LogoutInput } from "#/modules/auth/domain/auth.js";

import { hashRefreshToken } from "#/shared/security/refresh-token.js";

import type { AuthRepository } from "./ports/auth-repository.js";

export class LogoutUseCase {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(input: LogoutInput): Promise<void> {
    const refreshTokenHash = hashRefreshToken(input.refreshToken);
    const refreshToken =
      await this.authRepository.findActiveRefreshTokenByHash(refreshTokenHash);

    if (refreshToken === undefined) {
      return;
    }

    await this.authRepository.revokeRefreshToken(refreshToken.id);
  }
}
