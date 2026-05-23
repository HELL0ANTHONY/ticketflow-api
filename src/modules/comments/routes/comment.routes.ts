import type { FastifyInstance } from "fastify";

import { z } from "zod";

import type {
  AddCommentInput,
  ListCommentsInput,
} from "#/modules/comments/domain/comment.js";

import { AddCommentUseCase } from "#/modules/comments/application/add-comment.use-case.js";
import { ListCommentsUseCase } from "#/modules/comments/application/list-comments.use-case.js";
import { commentVisibilities } from "#/modules/comments/domain/comment.js";
import { DrizzleCommentRepository } from "#/modules/comments/infrastructure/drizzle-comment.repository.js";
import { db } from "#/shared/db/client.js";

const ticketIdParamsSchema = z.object({ id: z.uuid() }).strict();

const addCommentBodySchema = z
  .object({
    authorId: z.uuid(),
    body: z.string().trim().min(1).max(4_000),
    visibility: z.enum(commentVisibilities).optional(),
  })
  .strict();

const listCommentsQuerySchema = z
  .object({
    viewerId: z.uuid(),
  })
  .strict();

export function commentRoutes(app: FastifyInstance): void {
  const commentRepository = new DrizzleCommentRepository(db);
  const addCommentUseCase = new AddCommentUseCase(commentRepository);
  const listCommentsUseCase = new ListCommentsUseCase(commentRepository);

  app.post("/tickets/:id/comments", async (request, reply) => {
    const params = ticketIdParamsSchema.parse(request.params);
    const body = addCommentBodySchema.parse(request.body);
    const input: AddCommentInput = {
      authorId: body.authorId,
      body: body.body,
      ticketId: params.id,
      ...(body.visibility === undefined ? {} : { visibility: body.visibility }),
    };

    const comment = await addCommentUseCase.execute(input);

    return reply.code(201).send({ data: comment });
  });

  app.get("/tickets/:id/comments", async (request) => {
    const params = ticketIdParamsSchema.parse(request.params);
    const query = listCommentsQuerySchema.parse(request.query);
    const input: ListCommentsInput = {
      ticketId: params.id,
      viewerId: query.viewerId,
    };

    const comments = await listCommentsUseCase.execute(input);

    return { data: comments };
  });
}
