import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { and, asc, eq } from "drizzle-orm";

import type { CommentRepository } from "#/modules/comments/application/ports/comment-repository.js";
import type {
  AddCommentData,
  ListCommentsFilters,
  TicketComment,
} from "#/modules/comments/domain/comment.js";
import type * as databaseSchema from "#/shared/db/schema.js";

import {
  isPostgresError,
  postgresErrorCodes,
} from "#/shared/db/postgres-errors.js";
import { ticketComments, ticketEvents } from "#/shared/db/schema.js";
import { ConflictError } from "#/shared/errors/application-error.js";

type Database = NodePgDatabase<typeof databaseSchema>;

export class DrizzleCommentRepository implements CommentRepository {
  constructor(private readonly database: Database) {}

  async create(input: AddCommentData): Promise<TicketComment> {
    try {
      return await this.database.transaction(async (transaction) => {
        const [comment] = await transaction
          .insert(ticketComments)
          .values({
            authorId: input.authorId,
            body: input.body,
            ticketId: input.ticketId,
            visibility: input.visibility,
          })
          .returning();

        if (comment === undefined) {
          throw new Error("Comment insert did not return a row");
        }

        await transaction.insert(ticketEvents).values({
          actorId: input.authorId,
          eventType: "comment_added",
          metadata: {
            commentId: comment.id,
            visibility: comment.visibility,
          },
          ticketId: input.ticketId,
        });

        return comment;
      });
    } catch (error) {
      if (isPostgresError(error, postgresErrorCodes.foreignKeyViolation)) {
        throw new ConflictError(
          "authorId and ticketId must reference existing records",
        );
      }

      throw error;
    }
  }

  async listByTicketId(filters: ListCommentsFilters): Promise<TicketComment[]> {
    const conditions = [
      eq(ticketComments.ticketId, filters.ticketId),
      filters.includeInternal
        ? undefined
        : eq(ticketComments.visibility, "public"),
    ].filter(
      (condition): condition is NonNullable<typeof condition> =>
        condition !== undefined,
    );

    return this.database.query.ticketComments.findMany({
      orderBy: [asc(ticketComments.createdAt)],
      where: and(...conditions),
    });
  }
}
