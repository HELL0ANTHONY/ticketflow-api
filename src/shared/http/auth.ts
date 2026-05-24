import type { FastifyRequest } from "fastify";

import type { AccessTokenPayload } from "#/shared/security/jwt.js";

import { env } from "#/config/env.js";
import { UnauthorizedError } from "#/shared/errors/application-error.js";
import { verifyAccessToken } from "#/shared/security/jwt.js";

export function getAuthenticatedUser(
  request: FastifyRequest,
): AccessTokenPayload {
  const authorization = request.headers.authorization;

  if (authorization === undefined) {
    throw new UnauthorizedError("Missing authorization header");
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || token === undefined || token.length === 0) {
    throw new UnauthorizedError("Invalid authorization header");
  }

  return verifyAccessToken(token, env.jwtAccessTokenSecret);
}
