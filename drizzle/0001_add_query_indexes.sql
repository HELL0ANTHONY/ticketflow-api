CREATE UNIQUE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens" ("token_hash");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens" ("user_id");--> statement-breakpoint
CREATE INDEX "ticket_comments_ticket_id_idx" ON "ticket_comments" ("ticket_id");--> statement-breakpoint
CREATE INDEX "ticket_events_actor_id_idx" ON "ticket_events" ("actor_id");--> statement-breakpoint
CREATE INDEX "ticket_events_event_type_idx" ON "ticket_events" ("event_type");--> statement-breakpoint
CREATE INDEX "ticket_events_ticket_id_idx" ON "ticket_events" ("ticket_id");--> statement-breakpoint
CREATE INDEX "tickets_assigned_to_idx" ON "tickets" ("assigned_to");--> statement-breakpoint
CREATE INDEX "tickets_created_by_idx" ON "tickets" ("created_by");--> statement-breakpoint
CREATE INDEX "tickets_priority_idx" ON "tickets" ("priority");--> statement-breakpoint
CREATE INDEX "tickets_status_idx" ON "tickets" ("status");
