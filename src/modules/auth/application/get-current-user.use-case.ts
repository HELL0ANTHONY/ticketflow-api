import type { PublicUser } from "#/modules/users/domain/user.js";

import { toPublicUser } from "#/modules/users/domain/user.js";
import { UnauthorizedError } from "#/shared/errors/application-error.js";

import type { AuthRepository } from "./ports/auth-repository.js";

export class GetCurrentUserUseCase {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(userId: string): Promise<PublicUser> {
    const user = await this.authRepository.findUserById(userId);

    if (user === undefined) {
      throw new UnauthorizedError("Authenticated user no longer exists");
    }

    return toPublicUser(user);
  }
}
