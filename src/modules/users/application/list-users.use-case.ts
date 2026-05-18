import type {
  ListUsersFilters,
  PublicUser,
} from "#/modules/users/domain/user.js";

import { toPublicUser } from "#/modules/users/domain/user.js";

import type { UserRepository } from "./ports/user-repository.js";

export class ListUsersUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(filters: ListUsersFilters): Promise<PublicUser[]> {
    const users = await this.userRepository.list(filters);

    return users.map((user) => toPublicUser(user));
  }
}
