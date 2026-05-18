import type {
  GetUserByIdInput,
  ListUsersFilters,
  User,
} from "#/modules/users/domain/user.js";

export type UserRepository = {
  findById(input: GetUserByIdInput): Promise<User | undefined>;
  list(filters: ListUsersFilters): Promise<User[]>;
};
