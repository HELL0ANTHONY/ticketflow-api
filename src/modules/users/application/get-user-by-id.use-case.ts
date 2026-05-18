import type {
  GetUserByIdInput,
  PublicUser,
} from "#/modules/users/domain/user.js";

import { toPublicUser } from "#/modules/users/domain/user.js";
import { NotFoundError } from "#/shared/errors/application-error.js";

import type { UserRepository } from "./ports/user-repository.js";

export class GetUserByIdUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(input: GetUserByIdInput): Promise<PublicUser> {
    const user = await this.userRepository.findById(input);

    if (user === undefined) {
      throw new NotFoundError("User not found");
    }

    return toPublicUser(user);
  }
}
