import type { FastifyInstance } from "fastify";

export function healthcheckRoutes(app: FastifyInstance): void {
  app.get("/healtcheck", () => ({
    status: "ok",
  }));
}
