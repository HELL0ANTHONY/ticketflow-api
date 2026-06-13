import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";

import { ZodError } from "zod";

import { ApplicationError } from "#/shared/errors/application-error.js";

export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  if (error instanceof ZodError) {
    request.log.warn(
      {
        event: "http.validation_error",
        issues: error.issues,
      },
      "Request validation failed",
    );
    reply.code(400).send({
      error: "validation_error",
      issues: error.issues,
      message: "Invalid request payload",
    });
    return;
  }

  if (error instanceof ApplicationError) {
    request.log.warn(
      {
        event: "http.application_error",
        err: error,
        statusCode: error.statusCode,
      },
      "Request failed with application error",
    );
    reply.code(error.statusCode).send({
      error: error.name,
      message: error.message,
    });
    return;
  }

  request.log.error(
    {
      event: "http.unexpected_error",
      err: error,
    },
    "Unexpected request error",
  );

  reply.code(500).send({
    error: "internal_server_error",
    message: "Unexpected error",
  });
}
