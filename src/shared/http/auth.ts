import type { FastifyRequest } from "fastify";

import type { UserRole } from "#/modules/users/domain/user.js";
import type { AccessTokenPayload } from "#/shared/security/jwt.js";

import { env } from "#/config/env.js";
import { userRoles } from "#/modules/users/domain/user.js";
import {
  ForbiddenError,
  UnauthorizedError,
} from "#/shared/errors/application-error.js";
import { verifyAccessToken } from "#/shared/security/jwt.js";

type AuthenticatedUserPayload = Omit<AccessTokenPayload, "role"> & {
  role: UserRole;
};

export function requireAuthenticatedUser(
  request: FastifyRequest,
): AuthenticatedUserPayload {
  const authorization = request.headers.authorization;

  if (authorization === undefined) {
    throw new UnauthorizedError("Missing authorization header");
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || token === undefined || token.length === 0) {
    throw new UnauthorizedError("Invalid authorization header");
  }

  const authenticatedUser = verifyAccessToken(token, env.jwtAccessTokenSecret);

  const role = authenticatedUser.role;

  if (!isUserRole(role)) {
    throw new UnauthorizedError("Invalid access token");
  }

  return {
    ...authenticatedUser,
    role,
  };
}

export function requireRole(
  request: FastifyRequest,
  roles: readonly UserRole[],
): AuthenticatedUserPayload {
  const authenticatedUser = requireAuthenticatedUser(request);

  if (!roles.includes(authenticatedUser.role)) {
    throw new ForbiddenError("Insufficient permissions");
  }

  return authenticatedUser;
}

export const getAuthenticatedUser = requireAuthenticatedUser;

function isUserRole(role: string): role is UserRole {
  return userRoles.includes(role as UserRole);
}
