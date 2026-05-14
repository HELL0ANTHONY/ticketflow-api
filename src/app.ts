import Fastify, { type FastifyInstance } from "fastify";

import { healthcheckRoutes } from "#/shared/http/routes/healthcheck.routes.js";

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: true,
  });

  app.register(healthcheckRoutes);

  return app;
}
