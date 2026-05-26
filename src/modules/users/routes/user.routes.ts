import type { FastifyInstance } from "fastify";

import { z } from "zod";

import type {
  ChangeUserRoleInput,
  GetUserByIdInput,
  ListUsersFilters,
} from "#/modules/users/domain/user.js";

import { ChangeUserRoleUseCase } from "#/modules/users/application/change-user-role.use-case.js";
import { GetUserByIdUseCase } from "#/modules/users/application/get-user-by-id.use-case.js";
import { ListUsersUseCase } from "#/modules/users/application/list-users.use-case.js";
import { userRoles } from "#/modules/users/domain/user.js";
import { DrizzleUserRepository } from "#/modules/users/infrastructure/drizzle-user.repository.js";
import { db } from "#/shared/db/client.js";
import { ForbiddenError } from "#/shared/errors/application-error.js";
import {
  requireAuthenticatedUser,
  requirePermission,
} from "#/shared/http/auth.js";
import {
  canListUsers,
  canManageUserRoles,
  canViewUser,
} from "#/shared/security/permissions.js";

const userIdParamsSchema = z.object({ id: z.uuid() }).strict();

const listUsersQuerySchema = z
  .object({
    role: z.enum(userRoles).optional(),
  })
  .strict();

const changeUserRoleBodySchema = z
  .object({
    role: z.enum(userRoles),
  })
  .strict();

export function userRoutes(app: FastifyInstance): void {
  const userRepository = new DrizzleUserRepository(db);
  const changeUserRoleUseCase = new ChangeUserRoleUseCase(userRepository);
  const getUserByIdUseCase = new GetUserByIdUseCase(userRepository);
  const listUsersUseCase = new ListUsersUseCase(userRepository);

  app.get("/users/:id", async (request) => {
    const authenticatedUser = requireAuthenticatedUser(request);
    const params = userIdParamsSchema.parse(request.params);

    if (!canViewUser(toPermissionSubject(authenticatedUser), params.id)) {
      throw new ForbiddenError("Insufficient permissions");
    }

    const input: GetUserByIdInput = { id: params.id };
    const user = await getUserByIdUseCase.execute(input);

    return { data: user };
  });

  app.get("/users", async (request) => {
    requirePermission(request, canListUsers);

    const query = listUsersQuerySchema.parse(request.query);
    const filters: ListUsersFilters = {
      ...(query.role === undefined ? {} : { role: query.role }),
    };

    const users = await listUsersUseCase.execute(filters);
    return { data: users };
  });

  app.patch("/users/:id/role", async (request) => {
    const authenticatedUser = requireAuthenticatedUser(request);
    const params = userIdParamsSchema.parse(request.params);
    const body = changeUserRoleBodySchema.parse(request.body);

    if (!canManageUserRoles(authenticatedUser)) {
      throw new ForbiddenError("Insufficient permissions");
    }

    const input: ChangeUserRoleInput = {
      actorId: authenticatedUser.sub,
      role: body.role,
      userId: params.id,
    };

    const user = await changeUserRoleUseCase.execute(input);

    return { data: user };
  });
}

function toPermissionSubject(
  authenticatedUser: ReturnType<typeof requireAuthenticatedUser>,
): { id: string; role: (typeof authenticatedUser)["role"] } {
  return {
    id: authenticatedUser.sub,
    role: authenticatedUser.role,
  };
}
