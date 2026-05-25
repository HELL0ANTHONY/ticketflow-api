import type {
  AddCommentData,
  ListCommentsFilters,
  TicketComment,
} from "#/modules/comments/domain/comment.js";

export type CommentRepository = {
  create(input: AddCommentData): Promise<TicketComment>;
  listByTicketId(filters: ListCommentsFilters): Promise<TicketComment[]>;
};
