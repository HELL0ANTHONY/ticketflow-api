import type { FastifyInstance, FastifyRequest } from "fastify";

import { collectDefaultMetrics, Counter, Histogram, register } from "prom-client";

import type { ApplicationError } from "#/shared/errors/application-error.js";

import { env } from "#/config/env.js";

const requestStartTimes = new WeakMap<FastifyRequest, bigint>();

let initialized = false;

const httpRequestsTotal = new Counter({
  help: "Total HTTP requests handled by the API.",
  labelNames: ["method", "route", "service", "status_code"] as const,
  name: "http_server_requests_total",
});

const httpRequestDurationSeconds = new Histogram({
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  help: "HTTP request duration in seconds.",
  labelNames: ["method", "route", "service", "status_code"] as const,
  name: "http_server_request_duration_seconds",
});

const httpApplicationErrorsTotal = new Counter({
  help: "Total HTTP application errors returned by the API.",
  labelNames: ["error", "route", "service", "status_code"] as const,
  name: "http_application_errors_total",
});

const authFailuresTotal = new Counter({
  help: "Total authentication and authorization failures returned by the API.",
  labelNames: ["error", "route", "service", "status_code"] as const,
  name: "http_auth_failures_total",
});

export function metricsPlugin(app: FastifyInstance): void {
  initializeMetrics();

  app.addHook("onRequest", (request, _reply, done) => {
    requestStartTimes.set(request, process.hrtime.bigint());
    done();
  });

  app.addHook("onResponse", (request, reply, done) => {
    const startTime = requestStartTimes.get(request);

    if (startTime !== undefined) {
      const durationSeconds =
        Number(process.hrtime.bigint() - startTime) / 1_000_000_000;
      const labels = {
        method: request.method,
        route: getRouteLabel(request),
        service: env.serviceName,
        status_code: String(reply.statusCode),
      };

      httpRequestsTotal.inc(labels);
      httpRequestDurationSeconds.observe(labels, durationSeconds);
    }

    done();
  });

  if (env.metricsEnabled) {
    app.get("/metrics", async (_request, reply) => {
      reply.header("content-type", register.contentType);

      return register.metrics();
    });
  }
}

export function recordHttpApplicationError(
  error: ApplicationError,
  request: FastifyRequest,
): void {
  const labels = {
    error: error.name,
    route: getRouteLabel(request),
    service: env.serviceName,
    status_code: String(error.statusCode),
  };

  httpApplicationErrorsTotal.inc(labels);

  if (error.statusCode === 401 || error.statusCode === 403) {
    authFailuresTotal.inc(labels);
  }
}

function initializeMetrics(): void {
  if (initialized) {
    return;
  }

  collectDefaultMetrics({
    labels: {
      service: env.serviceName,
    },
    prefix: "nodejs_",
    register,
  });
  initialized = true;
}

function getRouteLabel(request: FastifyRequest): string {
  return request.routeOptions.url ?? "unmatched";
}
