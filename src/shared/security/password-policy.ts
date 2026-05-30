import { ValidationError } from "#/shared/errors/application-error.js";

export const passwordPolicy = {
  maxLength: 72,
  minLength: 8,
} as const;

export function assertPasswordPolicy(password: string): void {
  if (
    password.length < passwordPolicy.minLength ||
    password.length > passwordPolicy.maxLength
  ) {
    throw new ValidationError(
      `Password must be between ${passwordPolicy.minLength} and ${passwordPolicy.maxLength} characters`,
    );
  }

  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new ValidationError("Password must include at least one letter and one number");
  }
}
