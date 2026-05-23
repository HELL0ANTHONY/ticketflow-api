import type {
  ChangeUserRoleInput,
  PublicUser,
  User,
} from "#/modules/users/domain/user.js";

import { toPublicUser } from "#/modules/users/domain/user.js";
import {
  ForbiddenError,
  NotFoundError,
} from "#/shared/errors/application-error.js";

import type { UserRepository } from "./ports/user-repository.js";

export class ChangeUserRoleUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(input: ChangeUserRoleInput): Promise<PublicUser> {
    const actor = await this.userRepository.findById({ id: input.actorId });

    if (actor === undefined) {
      throw new NotFoundError("Actor not found");
    }

    if (!canChangeUserRoles(actor)) {
      throw new ForbiddenError("Actor cannot change user roles");
    }

    const user = await this.userRepository.findById({ id: input.userId });

    if (user === undefined) {
      throw new NotFoundError("User not found");
    }

    const updatedUser = await this.userRepository.changeRole(input);

    return toPublicUser(updatedUser);
  }
}

function canChangeUserRoles(user: User): boolean {
  return user.role === "admin";
}
