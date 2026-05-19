import bcrypt from "bcrypt";

import type {
  CreateUserInput,
  PublicUser,
} from "#/modules/users/domain/user.js";

import { toPublicUser } from "#/modules/users/domain/user.js";

import type { UserRepository } from "./ports/user-repository.js";

export class CreateUserUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(input: CreateUserInput): Promise<PublicUser> {
    const passwordHash = await bcrypt.hash(input.password, 10);
    const newUser = await this.userRepository.create({
      ...input,
      password: passwordHash,
    });

    return toPublicUser(newUser);
  }
}
