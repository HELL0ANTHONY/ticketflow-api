import type { FastifyInstance } from "fastify";

import { z } from "zod";

import type {
  GetUserByIdInput,
  ListUsersFilters,
} from "#/modules/users/domain/user.js";

import { GetUserByIdUseCase } from "#/modules/users/application/get-user-by-id.use-case.js";
import { userRoles } from "#/modules/users/domain/user.js";
import { DrizzleUserRepository } from "#/modules/users/infrastructure/drizzle-user.repository.js";
import { db } from "#/shared/db/client.js";

import { ListUsersUseCase } from "../application/list-users.use-case.js";

const userIdParamsSchema = z.object({ id: z.uuid() }).strict();

const listUsersQuerySchema = z
  .object({
    role: z.enum(userRoles).optional(),
  })
  .strict();

export function userRoutes(app: FastifyInstance): void {
  const userRepository = new DrizzleUserRepository(db);
  const getUserByIdUseCase = new GetUserByIdUseCase(userRepository);
  const listUsersUseCase = new ListUsersUseCase(userRepository);

  app.get("/user/:id", async (request) => {
    const params = userIdParamsSchema.parse(request.params);
    const input: GetUserByIdInput = { id: params.id };
    const user = await getUserByIdUseCase.execute(input);

    return { data: user };
  });

  app.get("/users", async (request) => {
    const query = listUsersQuerySchema.parse(request.query);
    const filters: ListUsersFilters = {
      ...(query.role === undefined ? {} : { role: query.role }),
    };

    const users = await listUsersUseCase.execute(filters);
    return { data: users };
  });
}
