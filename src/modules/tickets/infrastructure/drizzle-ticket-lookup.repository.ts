import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { eq } from "drizzle-orm";

import type { TicketLookup } from "#/modules/tickets/application/ports/ticket-lookup.js";
import type { TicketSummary } from "#/modules/tickets/domain/ticket.js";
import type * as databaseSchema from "#/shared/db/schema.js";

import { tickets } from "#/shared/db/schema.js";

type Database = NodePgDatabase<typeof databaseSchema>;

export class DrizzleTicketLookupRepository implements TicketLookup {
  constructor(private readonly database: Database) {}

  async findTicketSummaryById(id: string): Promise<TicketSummary | undefined> {
    return this.database.query.tickets.findFirst({
      columns: {
        id: true,
      },
      where: eq(tickets.id, id),
    });
  }
}
