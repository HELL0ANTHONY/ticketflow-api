import type { GetUserByIdInput, User } from "#/modules/users/domain/user.js";

export type UserRepository = {
  findById(input: GetUserByIdInput): Promise<User | undefined>;
};
