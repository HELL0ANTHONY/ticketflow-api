import type { PublicUser, User } from "#/modules/users/domain/user.js";

export type AuthUser = User;

export type RegisterInput = {
  email: string;
  name: string;
  password: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type RefreshSessionInput = {
  refreshToken: string;
};

export type LogoutInput = {
  refreshToken: string;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
};

export type RefreshTokenRecord = {
  expiresAt: Date;
  id: string;
  revokedAt: Date | null;
  tokenHash: string;
  userId: string;
};
