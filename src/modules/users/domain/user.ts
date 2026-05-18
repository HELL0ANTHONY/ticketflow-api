export const userRoles = ["admin", "agent", "customer"] as const;
export type UserRole = (typeof userRoles)[number];

export type User = {
  createdAt: Date;
  email: string;
  id: string;
  name: string;
  passwordHash: string;
  role: UserRole;
};

export type GetUserByIdInput = {
  id: string;
};

export type ListUsersFilters = {
  role?: UserRole;
};

export type PublicUser = Omit<User, "passwordHash">;

export function toPublicUser(user: User): PublicUser {
  return {
    createdAt: user.createdAt,
    email: user.email,
    id: user.id,
    name: user.name,
    role: user.role,
  };
}
