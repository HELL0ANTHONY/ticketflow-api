import Fastify, { type FastifyInstance } from "fastify";

import { auditRoutes } from "#/modules/audit/routes/audit.routes.js";
import { commentRoutes } from "#/modules/comments/routes/comment.routes.js";
import { ticketRoutes } from "#/modules/tickets/routes/ticket.routes.js";
import { userRoutes } from "#/modules/users/routes/user.routes.js";
import { errorHandler } from "#/shared/http/error-handler.js";
import { healthcheckRoutes } from "#/shared/http/routes/healthcheck.routes.js";

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: true,
  });

  app.setErrorHandler(errorHandler);
  app.register(healthcheckRoutes);
  app.register(auditRoutes);
  app.register(ticketRoutes);
  app.register(commentRoutes);
  app.register(userRoutes);

  return app;
}
