import type {
  ListCommentsInput,
  TicketComment,
} from "#/modules/comments/domain/comment.js";
import type { TicketLookup } from "#/modules/tickets/application/ports/ticket-lookup.js";
import type { UserLookup } from "#/modules/users/application/ports/user-lookup.js";

import { canAccessInternalComments } from "#/modules/comments/domain/comment.js";
import { NotFoundError } from "#/shared/errors/application-error.js";

import type { CommentRepository } from "./ports/comment-repository.js";

export class ListCommentsUseCase {
  constructor(
    private readonly commentRepository: CommentRepository,
    private readonly ticketLookup: TicketLookup,
    private readonly userLookup: UserLookup,
  ) {}

  async execute(input: ListCommentsInput): Promise<TicketComment[]> {
    const ticket = await this.ticketLookup.findTicketSummaryById(input.ticketId);

    if (ticket === undefined) {
      throw new NotFoundError("Ticket not found");
    }

    const viewer = await this.userLookup.findUserSummaryById(input.viewerId);

    if (viewer === undefined) {
      throw new NotFoundError("Viewer not found");
    }

    return this.commentRepository.listByTicketId({
      includeInternal: canAccessInternalComments(viewer),
      ticketId: input.ticketId,
    });
  }
}
