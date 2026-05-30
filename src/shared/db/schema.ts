import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { ticketEventTypes } from "#/shared/domain/ticket-event.js";

export const commentVisibility = pgEnum("comment_visibility", [
  "public",
  "internal",
]);

export const ticketEventType = pgEnum("ticket_event_type", ticketEventTypes);

export const ticketPriority = pgEnum("ticket_priority", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const ticketStatus = pgEnum("ticket_status", [
  "open",
  "assigned",
  "in_progress",
  "resolved",
  "closed",
  "cancelled",
]);

export const userRole = pgEnum("user_role", ["admin", "agent", "customer"]);

export const users = pgTable("users", {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  email: text("email").notNull().unique(),
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").default("customer").notNull(),
});

export const tickets = pgTable(
  "tickets",
  {
    assignedTo: uuid("assigned_to").references(() => users.id),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    description: text("description").notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    priority: ticketPriority("priority").default("medium").notNull(),
    status: ticketStatus("status").default("open").notNull(),
    title: text("title").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("tickets_assigned_to_idx").on(table.assignedTo),
    index("tickets_created_by_idx").on(table.createdBy),
    index("tickets_priority_idx").on(table.priority),
    index("tickets_status_idx").on(table.status),
  ],
);

export const ticketComments = pgTable(
  "ticket_comments",
  {
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id),
    visibility: commentVisibility("visibility").default("public").notNull(),
  },
  (table) => [index("ticket_comments_ticket_id_idx").on(table.ticketId)],
);

export const ticketEvents = pgTable(
  "ticket_events",
  {
    actorId: uuid("actor_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    eventType: ticketEventType("event_type").notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    metadata: jsonb("metadata"),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id),
  },
  (table) => [
    index("ticket_events_actor_id_idx").on(table.actorId),
    index("ticket_events_event_type_idx").on(table.eventType),
    index("ticket_events_ticket_id_idx").on(table.ticketId),
  ],
);

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    tokenHash: text("token_hash").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
  },
  (table) => [
    uniqueIndex("refresh_tokens_token_hash_idx").on(table.tokenHash),
    index("refresh_tokens_user_id_idx").on(table.userId),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  assignedTickets: many(tickets, {
    relationName: "assigned_tickets",
  }),
  comments: many(ticketComments),
  createdTickets: many(tickets, {
    relationName: "created_tickets",
  }),
  events: many(ticketEvents),
  refreshTokens: many(refreshTokens),
}));

export const ticketsRelations = relations(tickets, ({ many, one }) => ({
  assignedToUser: one(users, {
    fields: [tickets.assignedTo],
    references: [users.id],
    relationName: "assigned_tickets",
  }),
  comments: many(ticketComments),
  createdByUser: one(users, {
    fields: [tickets.createdBy],
    references: [users.id],
    relationName: "created_tickets",
  }),
  events: many(ticketEvents),
}));

export const ticketCommentsRelations = relations(ticketComments, ({ one }) => ({
  author: one(users, {
    fields: [ticketComments.authorId],
    references: [users.id],
  }),
  ticket: one(tickets, {
    fields: [ticketComments.ticketId],
    references: [tickets.id],
  }),
}));

export const ticketEventsRelations = relations(ticketEvents, ({ one }) => ({
  actor: one(users, {
    fields: [ticketEvents.actorId],
    references: [users.id],
  }),
  ticket: one(tickets, {
    fields: [ticketEvents.ticketId],
    references: [tickets.id],
  }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));
