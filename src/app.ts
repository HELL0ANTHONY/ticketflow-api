import Fastify, { type FastifyInstance } from "fastify";

import { ticketRoutes } from "#/modules/tickets/routes/ticket.routes.js";
import { errorHandler } from "#/shared/http/error-handler.js";
import { healthcheckRoutes } from "#/shared/http/routes/healthcheck.routes.js";

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: true,
  });

  app.setErrorHandler(errorHandler);
  app.register(healthcheckRoutes);
  app.register(ticketRoutes);

  return app;
}
