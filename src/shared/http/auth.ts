import type { FastifyInstance, FastifyRequest } from "fastify";

import type { UserRole } from "#/modules/users/domain/user.js";
import type { AccessTokenPayload } from "#/shared/security/jwt.js";

import { env } from "#/config/env.js";
import { userRoles } from "#/modules/users/domain/user.js";
import {
  ForbiddenError,
  UnauthorizedError,
} from "#/shared/errors/application-error.js";
import { verifyAccessToken } from "#/shared/security/jwt.js";
import {
  hasAnyRole,
  type PermissionSubject,
} from "#/shared/security/permissions.js";

export type AuthenticatedUserPayload = Omit<AccessTokenPayload, "role"> & {
  role: UserRole;
};

declare module "fastify" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface FastifyRequest {
    authenticatedUser: AuthenticatedUserPayload | null;
  }
}

export function authContextPlugin(app: FastifyInstance): void {
  app.decorateRequest("authenticatedUser", null);

  app.addHook("onRequest", (request, _reply, done) => {
    request.authenticatedUser = getOptionalAuthenticatedUser(request);
    done();
  });
}

export function requireAuthenticatedUser(
  request: FastifyRequest,
): AuthenticatedUserPayload {
  if (request.authenticatedUser !== null) {
    return request.authenticatedUser;
  }

  request.authenticatedUser = getAuthenticatedUserFromHeader(request);

  return request.authenticatedUser;
}

function getOptionalAuthenticatedUser(
  request: FastifyRequest,
): AuthenticatedUserPayload | null {
  const authorization = request.headers.authorization;

  if (authorization === undefined) {
    return null;
  }

  return getAuthenticatedUserFromHeader(request);
}

function getAuthenticatedUserFromHeader(
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

  if (!hasAnyRole(authenticatedUser, roles)) {
    throw new ForbiddenError("Insufficient permissions");
  }

  return authenticatedUser;
}

export function requirePermission(
  request: FastifyRequest,
  isAllowed: (subject: PermissionSubject) => boolean,
): AuthenticatedUserPayload {
  const authenticatedUser = requireAuthenticatedUser(request);
  const subject = toPermissionSubject(authenticatedUser);

  if (!isAllowed(subject)) {
    throw new ForbiddenError("Insufficient permissions");
  }

  return authenticatedUser;
}

export const getAuthenticatedUser = requireAuthenticatedUser;

function isUserRole(role: string): role is UserRole {
  return userRoles.includes(role as UserRole);
}

function toPermissionSubject(
  authenticatedUser: AuthenticatedUserPayload,
): PermissionSubject {
  return {
    id: authenticatedUser.sub,
    role: authenticatedUser.role,
  };
}
