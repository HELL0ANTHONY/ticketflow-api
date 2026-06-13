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
    authenticatedUser: AuthenticatedUserPayload | null | undefined;
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
  if (
    request.authenticatedUser !== null &&
    request.authenticatedUser !== undefined
  ) {
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
    request.log.warn(
      { event: "auth.missing_authorization_header" },
      "Missing authorization header",
    );
    throw new UnauthorizedError("Missing authorization header");
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || token === undefined || token.length === 0) {
    request.log.warn(
      { event: "auth.invalid_authorization_header" },
      "Invalid authorization header",
    );
    throw new UnauthorizedError("Invalid authorization header");
  }

  let authenticatedUser: AccessTokenPayload;

  try {
    authenticatedUser = verifyAccessToken(token, env.jwtAccessTokenSecret);
  } catch (error) {
    request.log.warn(
      {
        event: "auth.invalid_access_token",
        err: error,
      },
      "Invalid access token",
    );
    throw error;
  }

  const role = authenticatedUser.role;

  if (!isUserRole(role)) {
    request.log.warn(
      {
        event: "auth.invalid_access_token_role",
        role,
        userId: authenticatedUser.sub,
      },
      "Invalid access token role",
    );
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
    request.log.warn(
      {
        event: "auth.insufficient_role",
        requiredRoles: roles,
        role: authenticatedUser.role,
        userId: authenticatedUser.sub,
      },
      "Authenticated user has insufficient role",
    );
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
    request.log.warn(
      {
        event: "auth.insufficient_permission",
        role: subject.role,
        userId: subject.id,
      },
      "Authenticated user has insufficient permission",
    );
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
