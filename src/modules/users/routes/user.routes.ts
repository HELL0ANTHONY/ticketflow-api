import type { FastifyInstance } from "fastify";

import { z } from "zod";

import type {
  ChangeUserRoleInput,
  CreateUserInput,
  GetUserByIdInput,
  ListUsersFilters,
} from "#/modules/users/domain/user.js";

import { ChangeUserRoleUseCase } from "#/modules/users/application/change-user-role.use-case.js";
import { CreateUserUseCase } from "#/modules/users/application/create-user.use-case.js";
import { GetUserByIdUseCase } from "#/modules/users/application/get-user-by-id.use-case.js";
import { ListUsersUseCase } from "#/modules/users/application/list-users.use-case.js";
import { userRoles } from "#/modules/users/domain/user.js";
import { DrizzleUserRepository } from "#/modules/users/infrastructure/drizzle-user.repository.js";
import { db } from "#/shared/db/client.js";

const createUserBodySchema = z
  .object({
    email: z.email(),
    name: z.string().trim().min(5).max(50),
    password: z.string().trim().min(1).max(30),
    role: z.enum(userRoles).optional(),
  })
  .strict();

const userIdParamsSchema = z.object({ id: z.uuid() }).strict();

const listUsersQuerySchema = z
  .object({
    role: z.enum(userRoles).optional(),
  })
  .strict();

const changeUserRoleBodySchema = z
  .object({
    actorId: z.uuid(),
    role: z.enum(userRoles),
  })
  .strict();

export function userRoutes(app: FastifyInstance): void {
  const userRepository = new DrizzleUserRepository(db);
  const changeUserRoleUseCase = new ChangeUserRoleUseCase(userRepository);
  const createUserUseCase = new CreateUserUseCase(userRepository);
  const getUserByIdUseCase = new GetUserByIdUseCase(userRepository);
  const listUsersUseCase = new ListUsersUseCase(userRepository);

  app.post("/users", async (request, reply) => {
    const body = createUserBodySchema.parse(request.body);
    const input: CreateUserInput = {
      email: body.email,
      name: body.name,
      password: body.password,
      ...(body.role === undefined ? {} : { role: body.role }),
    };

    const user = await createUserUseCase.execute(input);

    return reply.code(201).send({ data: user });
  });

  app.get("/users/:id", async (request) => {
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

  app.patch("/users/:id/role", async (request) => {
    const params = userIdParamsSchema.parse(request.params);
    const body = changeUserRoleBodySchema.parse(request.body);
    const input: ChangeUserRoleInput = {
      actorId: body.actorId,
      role: body.role,
      userId: params.id,
    };

    const user = await changeUserRoleUseCase.execute(input);

    return { data: user };
  });
}
