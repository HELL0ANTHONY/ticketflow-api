import type {
  ListCommentsInput,
  TicketComment,
} from "#/modules/comments/domain/comment.js";

import { canAccessInternalComments } from "#/modules/comments/domain/comment.js";
import { NotFoundError } from "#/shared/errors/application-error.js";

import type { CommentRepository } from "./ports/comment-repository.js";

export class ListCommentsUseCase {
  constructor(private readonly commentRepository: CommentRepository) {}

  async execute(input: ListCommentsInput): Promise<TicketComment[]> {
    const ticket = await this.commentRepository.findTicketById(input.ticketId);

    if (ticket === undefined) {
      throw new NotFoundError("Ticket not found");
    }

    const viewer = await this.commentRepository.findUserById(input.viewerId);

    if (viewer === undefined) {
      throw new NotFoundError("Viewer not found");
    }

    return this.commentRepository.listByTicketId({
      includeInternal: canAccessInternalComments(viewer),
      ticketId: input.ticketId,
    });
  }
}
