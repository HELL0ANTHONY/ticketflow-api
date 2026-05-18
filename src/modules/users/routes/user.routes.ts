import type { FastifyInstance } from "fastify";

import { z } from "zod";

import type { GetUserByIdInput } from "#/modules/users/domain/user.js";

import { GetUserByIdUseCase } from "#/modules/users/application/get-user-by-id.use-case.js";
import { DrizzleUserRepository } from "#/modules/users/infrastructure/drizzle-user.repository.js";
import { db } from "#/shared/db/client.js";

const userIdParamsSchema = z.object({ id: z.uuid() }).strict();

export function userRoutes(app: FastifyInstance): void {
  const userRepository = new DrizzleUserRepository(db);
  const getUserByIdUseCase = new GetUserByIdUseCase(userRepository);

  app.get("/user/:id", async (request) => {
    const params = userIdParamsSchema.parse(request.params);
    const input: GetUserByIdInput = { id: params.id };
    const user = await getUserByIdUseCase.execute(input);

    return { data: user };
  });
}
