import { env } from "#/config/env.js";
import {
  shutdownTracing,
  startTracing,
} from "#/shared/observability/tracing.js";

startTracing();

const { buildApp } = await import("#/app.js");
const app = buildApp();

await app.listen({
  host: "0.0.0.0",
  port: env.apiPort,
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  app.log.info({ event: "process.shutdown", signal }, "Shutting down API");
  await app.close();
  await shutdownTracing();
  process.exit(0);
}

process.once("SIGINT", (signal) => {
  void shutdown(signal);
});

process.once("SIGTERM", (signal) => {
  void shutdown(signal);
});
