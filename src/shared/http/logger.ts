import type {
  FastifyError,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import type {
  FastifyLoggerOptions,
  ResSerializerReply,
} from "fastify/types/logger.js";
import type { RawServerDefault } from "fastify/types/utils.js";
import type { IncomingMessage } from "node:http";

import { randomUUID } from "node:crypto";

import { env } from "#/config/env.js";

type LoggerOptions = false | FastifyLoggerOptions;
type ProductionLoggerOptions = FastifyLoggerOptions & {
  base: {
    environment: string;
    service: string;
  };
  formatters: {
    level(label: string): { level: string };
  };
  messageKey: string;
  redact: {
    censor: string;
    paths: string[];
  };
  timestamp(): string;
};

const requestIdHeaderName = "x-request-id";
const validRequestId = /^[A-Za-z0-9._:/=-]{1,128}$/;

export function buildLoggerOptions(): LoggerOptions {
  if (env.environment === "test" || env.logLevel === "silent") {
    return false;
  }

  const loggerOptions: ProductionLoggerOptions = {
    base: {
      environment: env.environment,
      service: env.serviceName,
    },
    formatters: {
      level(label: string) {
        return { level: label };
      },
    },
    level: env.logLevel,
    messageKey: "message",
    redact: {
      censor: "[REDACTED]",
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.headers.set-cookie",
        "res.headers.set-cookie",
        "*.password",
        "*.passwordHash",
        "*.accessToken",
        "*.refreshToken",
        "*.token",
        "*.tokenHash",
      ],
    },
    serializers: {
      err(error: FastifyError) {
        return {
          code: error.code,
          message: error.message,
          name: error.name,
          stack: env.environment === "production" ? "" : (error.stack ?? ""),
          statusCode: error.statusCode,
          type: error.name,
        };
      },
      req(request: FastifyRequest) {
        return {
          hostname: request.hostname,
          id: request.id,
          method: request.method,
          remoteAddress: request.ip,
          route: request.routeOptions.url,
          url: request.url,
        };
      },
      res(reply: ResSerializerReply<RawServerDefault, FastifyReply>) {
        return {
          statusCode: reply.statusCode,
        };
      },
    },
    timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  };

  return loggerOptions;
}

export function getRequestId(request: IncomingMessage): string {
  const header = request.headers[requestIdHeaderName];
  const candidate = Array.isArray(header) ? header[0] : header;

  if (candidate !== undefined && validRequestId.test(candidate)) {
    return candidate;
  }

  return randomUUID();
}

export const requestIdHeader = requestIdHeaderName;
