import type {
  AddCommentInput,
  TicketComment,
} from "#/modules/comments/domain/comment.js";

import { canAccessInternalComments } from "#/modules/comments/domain/comment.js";
import {
  ForbiddenError,
  NotFoundError,
} from "#/shared/errors/application-error.js";

import type { CommentRepository } from "./ports/comment-repository.js";

export class AddCommentUseCase {
  constructor(private readonly commentRepository: CommentRepository) {}

  async execute(input: AddCommentInput): Promise<TicketComment> {
    const ticket = await this.commentRepository.findTicketById(input.ticketId);

    if (ticket === undefined) {
      throw new NotFoundError("Ticket not found");
    }

    const author = await this.commentRepository.findUserById(input.authorId);

    if (author === undefined) {
      throw new NotFoundError("Author not found");
    }

    const visibility = input.visibility ?? "public";

    if (visibility === "internal" && !canAccessInternalComments(author)) {
      throw new ForbiddenError("Author cannot create internal comments");
    }

    return this.commentRepository.create({
      authorId: input.authorId,
      body: input.body,
      ticketId: input.ticketId,
      visibility,
    });
  }
}
