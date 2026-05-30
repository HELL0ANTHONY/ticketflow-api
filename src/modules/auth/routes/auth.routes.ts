import type { FastifyInstance } from "fastify";

import { z } from "zod";

import type {
  LoginInput,
  LogoutInput,
  RefreshSessionInput,
  RegisterInput,
} from "#/modules/auth/domain/auth.js";

import { GetCurrentUserUseCase } from "#/modules/auth/application/get-current-user.use-case.js";
import { LoginUseCase } from "#/modules/auth/application/login.use-case.js";
import { LogoutAllUseCase } from "#/modules/auth/application/logout-all.use-case.js";
import { LogoutUseCase } from "#/modules/auth/application/logout.use-case.js";
import { RefreshSessionUseCase } from "#/modules/auth/application/refresh-session.use-case.js";
import { RegisterUseCase } from "#/modules/auth/application/register.use-case.js";
import { DrizzleAuthRepository } from "#/modules/auth/infrastructure/drizzle-auth.repository.js";
import { DrizzleUserAuthLookupRepository } from "#/modules/users/infrastructure/drizzle-user-auth-lookup.repository.js";
import { DrizzleUserRepository } from "#/modules/users/infrastructure/drizzle-user.repository.js";
import { db } from "#/shared/db/client.js";
import { getAuthenticatedUser } from "#/shared/http/auth.js";
import { passwordPolicy } from "#/shared/security/password-policy.js";
import { assertRateLimit } from "#/shared/security/rate-limit.js";

const authRateLimitPolicy = {
  limit: 10,
  windowMs: 60_000,
} as const;

const registerBodySchema = z
  .object({
    email: z.email(),
    name: z.string().trim().min(5).max(50),
    password: z
      .string()
      .trim()
      .min(passwordPolicy.minLength)
      .max(passwordPolicy.maxLength)
      .refine(
        (password) => /[A-Za-z]/.test(password) && /[0-9]/.test(password),
        "Password must include at least one letter and one number",
      ),
  })
  .strict();

const loginBodySchema = z
  .object({
    email: z.email(),
    password: z.string().min(1).max(72),
  })
  .strict();

const refreshTokenBodySchema = z
  .object({
    refreshToken: z.string().min(1),
  })
  .strict();

export function authRoutes(app: FastifyInstance): void {
  const authRepository = new DrizzleAuthRepository(db);
  const userAuthLookup = new DrizzleUserAuthLookupRepository(db);
  const userRepository = new DrizzleUserRepository(db);
  const getCurrentUserUseCase = new GetCurrentUserUseCase(userAuthLookup);
  const loginUseCase = new LoginUseCase(authRepository, userAuthLookup);
  const logoutAllUseCase = new LogoutAllUseCase(authRepository);
  const logoutUseCase = new LogoutUseCase(authRepository);
  const refreshSessionUseCase = new RefreshSessionUseCase(
    authRepository,
    userAuthLookup,
  );
  const registerUseCase = new RegisterUseCase(authRepository, userRepository);

  app.post("/auth/register", async (request, reply) => {
    assertRateLimit(`auth:register:${request.ip}`, authRateLimitPolicy);

    const body = registerBodySchema.parse(request.body);
    const input: RegisterInput = {
      email: body.email,
      name: body.name,
      password: body.password,
    };

    const session = await registerUseCase.execute(input);

    return reply.code(201).send({ data: session });
  });

  app.post("/auth/login", async (request) => {
    assertRateLimit(`auth:login:${request.ip}`, authRateLimitPolicy);

    const body = loginBodySchema.parse(request.body);
    const input: LoginInput = {
      email: body.email,
      password: body.password,
    };

    const session = await loginUseCase.execute(input);

    return { data: session };
  });

  app.get("/me", async (request) => {
    const authenticatedUser = getAuthenticatedUser(request);
    const user = await getCurrentUserUseCase.execute(authenticatedUser.sub);

    return { data: user };
  });

  app.post("/auth/refresh", async (request) => {
    const body = refreshTokenBodySchema.parse(request.body);
    const input: RefreshSessionInput = {
      refreshToken: body.refreshToken,
    };

    const session = await refreshSessionUseCase.execute(input);

    return { data: session };
  });

  app.post("/auth/logout", async (request, reply) => {
    const body = refreshTokenBodySchema.parse(request.body);
    const input: LogoutInput = {
      refreshToken: body.refreshToken,
    };

    await logoutUseCase.execute(input);

    return reply.code(204).send();
  });

  app.post("/auth/logout-all", async (request, reply) => {
    const authenticatedUser = getAuthenticatedUser(request);

    await logoutAllUseCase.execute(authenticatedUser.sub);

    return reply.code(204).send();
  });
}
