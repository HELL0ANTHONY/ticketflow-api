import type {
  CreateUserInput,
  GetUserByIdInput,
  ListUsersFilters,
  User,
} from "#/modules/users/domain/user.js";

export type UserRepository = {
  create(input: CreateUserInput): Promise<User>;
  findById(input: GetUserByIdInput): Promise<User | undefined>;
  list(filters: ListUsersFilters): Promise<User[]>;
};
