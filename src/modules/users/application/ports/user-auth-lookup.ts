import type { User } from "#/modules/users/domain/user.js";

export type UserAuthLookup = {
  findUserByEmail(email: string): Promise<User | undefined>;
  findUserById(id: string): Promise<User | undefined>;
};
