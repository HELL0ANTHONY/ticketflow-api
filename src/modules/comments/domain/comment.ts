import type { UserSummary } from "#/modules/users/domain/user.js";

export const commentVisibilities = ["public", "internal"] as const;
export type CommentVisibility = (typeof commentVisibilities)[number];

export type TicketComment = {
  authorId: string;
  body: string;
  createdAt: Date;
  id: string;
  ticketId: string;
  visibility: CommentVisibility;
};

export type AddCommentInput = {
  authorId: string;
  body: string;
  ticketId: string;
  visibility?: CommentVisibility;
};

export type AddCommentData = {
  authorId: string;
  body: string;
  ticketId: string;
  visibility: CommentVisibility;
};

export type ListCommentsInput = {
  ticketId: string;
  viewerId: string;
};

export type ListCommentsFilters = {
  includeInternal: boolean;
  ticketId: string;
};

export function canAccessInternalComments(user: UserSummary): boolean {
  return user.role === "admin" || user.role === "agent";
}
