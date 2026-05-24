import bcrypt from "bcrypt";

import type { AuthSession, LoginInput } from "#/modules/auth/domain/auth.js";

import { UnauthorizedError } from "#/shared/errors/application-error.js";

import type { AuthRepository } from "./ports/auth-repository.js";

import { createAuthSession } from "./auth-session.factory.js";

export class LoginUseCase {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(input: LoginInput): Promise<AuthSession> {
    const user = await this.authRepository.findUserByEmail(input.email);

    if (user === undefined) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedError("Invalid email or password");
    }

    return createAuthSession(this.authRepository, user);
  }
}
