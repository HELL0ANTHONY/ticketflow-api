import bcrypt from "bcrypt";

import type { AuthSession, RegisterInput } from "#/modules/auth/domain/auth.js";
import type { UserRepository } from "#/modules/users/application/ports/user-repository.js";

import { assertPasswordPolicy } from "#/shared/security/password-policy.js";

import type { AuthRepository } from "./ports/auth-repository.js";

import { createAuthSession } from "./auth-session.factory.js";

export class RegisterUseCase {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(input: RegisterInput): Promise<AuthSession> {
    assertPasswordPolicy(input.password);

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await this.userRepository.create({
      email: input.email,
      name: input.name,
      passwordHash,
    });

    return createAuthSession(this.authRepository, user);
  }
}
