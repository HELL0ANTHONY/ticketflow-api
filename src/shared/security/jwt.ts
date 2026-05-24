import { createHmac, timingSafeEqual } from "node:crypto";

import { UnauthorizedError } from "#/shared/errors/application-error.js";

type JwtHeader = {
  alg: "HS256";
  typ: "JWT";
};

export type AccessTokenPayload = {
  email: string;
  exp: number;
  name: string;
  role: string;
  sub: string;
};

export type SignAccessTokenInput = {
  email: string;
  expiresInSeconds: number;
  name: string;
  role: string;
  secret: string;
  userId: string;
};

export function signAccessToken(input: SignAccessTokenInput): string {
  const header: JwtHeader = {
    alg: "HS256",
    typ: "JWT",
  };
  const payload: AccessTokenPayload = {
    email: input.email,
    exp: Math.floor(Date.now() / 1_000) + input.expiresInSeconds,
    name: input.name,
    role: input.role,
    sub: input.userId,
  };

  const encodedHeader = encodeBase64Url(JSON.stringify(header));
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = sign(`${encodedHeader}.${encodedPayload}`, input.secret);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyAccessToken(
  token: string,
  secret: string,
): AccessTokenPayload {
  const parts = token.split(".");

  if (parts.length !== 3) {
    throw new UnauthorizedError("Invalid access token");
  }

  const [encodedHeader, encodedPayload, signature] = parts;

  if (
    encodedHeader === undefined ||
    encodedPayload === undefined ||
    signature === undefined
  ) {
    throw new UnauthorizedError("Invalid access token");
  }

  const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`, secret);

  if (!isSameSignature(signature, expectedSignature)) {
    throw new UnauthorizedError("Invalid access token");
  }

  const header = parseJson(decodeBase64Url(encodedHeader));

  if (!isJwtHeader(header)) {
    throw new UnauthorizedError("Invalid access token");
  }

  const payload = parseJson(decodeBase64Url(encodedPayload));

  if (!isAccessTokenPayload(payload)) {
    throw new UnauthorizedError("Invalid access token");
  }

  if (payload.exp <= Math.floor(Date.now() / 1_000)) {
    throw new UnauthorizedError("Access token expired");
  }

  return payload;
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function isSameSignature(value: string, expected: string): boolean {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);

  return (
    valueBuffer.length === expectedBuffer.length &&
    timingSafeEqual(valueBuffer, expectedBuffer)
  );
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new UnauthorizedError("Invalid access token");
  }
}

function isJwtHeader(value: unknown): value is JwtHeader {
  return (
    typeof value === "object" &&
    value !== null &&
    "alg" in value &&
    value.alg === "HS256" &&
    "typ" in value &&
    value.typ === "JWT"
  );
}

function isAccessTokenPayload(value: unknown): value is AccessTokenPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "email" in value &&
    typeof value.email === "string" &&
    "exp" in value &&
    typeof value.exp === "number" &&
    "name" in value &&
    typeof value.name === "string" &&
    "role" in value &&
    typeof value.role === "string" &&
    "sub" in value &&
    typeof value.sub === "string"
  );
}
