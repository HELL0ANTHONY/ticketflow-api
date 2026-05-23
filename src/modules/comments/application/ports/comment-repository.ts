import type {
  AddCommentData,
  CommentTicketSummary,
  CommentUserSummary,
  ListCommentsFilters,
  TicketComment,
} from "#/modules/comments/domain/comment.js";

export type CommentRepository = {
  create(input: AddCommentData): Promise<TicketComment>;
  findTicketById(id: string): Promise<CommentTicketSummary | undefined>;
  findUserById(id: string): Promise<CommentUserSummary | undefined>;
  listByTicketId(filters: ListCommentsFilters): Promise<TicketComment[]>;
};
