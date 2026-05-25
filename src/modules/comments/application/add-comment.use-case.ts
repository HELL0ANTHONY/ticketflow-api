import type {
  AddCommentInput,
  TicketComment,
} from "#/modules/comments/domain/comment.js";
import type { TicketLookup } from "#/modules/tickets/application/ports/ticket-lookup.js";
import type { UserLookup } from "#/modules/users/application/ports/user-lookup.js";

import { canAccessInternalComments } from "#/modules/comments/domain/comment.js";
import {
  ForbiddenError,
  NotFoundError,
} from "#/shared/errors/application-error.js";

import type { CommentRepository } from "./ports/comment-repository.js";

export class AddCommentUseCase {
  constructor(
    private readonly commentRepository: CommentRepository,
    private readonly ticketLookup: TicketLookup,
    private readonly userLookup: UserLookup,
  ) {}

  async execute(input: AddCommentInput): Promise<TicketComment> {
    const ticket = await this.ticketLookup.findTicketSummaryById(input.ticketId);

    if (ticket === undefined) {
      throw new NotFoundError("Ticket not found");
    }

    const author = await this.userLookup.findUserSummaryById(input.authorId);

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
