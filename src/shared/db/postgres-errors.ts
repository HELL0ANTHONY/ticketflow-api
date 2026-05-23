import { DatabaseError } from "pg";

export const postgresErrorCodes = {
  foreignKeyViolation: "23503",
  uniqueViolation: "23505",
} as const;

export function isPostgresError(
  error: unknown,
  code: (typeof postgresErrorCodes)[keyof typeof postgresErrorCodes],
): boolean {
  if (error instanceof DatabaseError) {
    return error.code === code;
  }

  if (error instanceof Error && error.cause !== undefined) {
    return isPostgresError(error.cause, code);
  }

  return false;
}
