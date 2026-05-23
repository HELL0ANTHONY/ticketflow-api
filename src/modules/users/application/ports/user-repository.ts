import type {
  ChangeUserRoleInput,
  CreateUserData,
  GetUserByIdInput,
  ListUsersFilters,
  User,
} from "#/modules/users/domain/user.js";

export type UserRepository = {
  changeRole(input: ChangeUserRoleInput): Promise<User>;
  create(input: CreateUserData): Promise<User>;
  findById(input: GetUserByIdInput): Promise<User | undefined>;
  list(filters: ListUsersFilters): Promise<User[]>;
};
