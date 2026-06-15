import Fastify, { type FastifyInstance } from "fastify";

import { auditRoutes } from "#/modules/audit/routes/audit.routes.js";
import { authRoutes } from "#/modules/auth/routes/auth.routes.js";
import { commentRoutes } from "#/modules/comments/routes/comment.routes.js";
import { ticketRoutes } from "#/modules/tickets/routes/ticket.routes.js";
import { userRoutes } from "#/modules/users/routes/user.routes.js";
import { authContextPlugin } from "#/shared/http/auth.js";
import { errorHandler } from "#/shared/http/error-handler.js";
import {
  buildLoggerOptions,
  getRequestId,
  requestIdHeader,
} from "#/shared/http/logger.js";
import { healthcheckRoutes } from "#/shared/http/routes/healthcheck.routes.js";
import { metricsPlugin } from "#/shared/observability/metrics.js";

export function buildApp(): FastifyInstance {
  const app = Fastify({
    genReqId: getRequestId,
    logger: buildLoggerOptions(),
    requestIdHeader,
  });

  app.setErrorHandler(errorHandler);
  app.register(metricsPlugin);
  app.register(authContextPlugin);
  app.register(healthcheckRoutes);
  app.register(authRoutes);
  app.register(auditRoutes);
  app.register(ticketRoutes);
  app.register(commentRoutes);
  app.register(userRoutes);

  return app;
}
