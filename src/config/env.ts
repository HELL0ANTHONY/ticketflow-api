import { z } from "zod";

type Env = {
  accessTokenExpiresInSeconds: number;
  apiPort: number;
  databaseUrl: string;
  environment: "development" | "production" | "test";
  jwtAccessTokenSecret: string;
  logLevel: "debug" | "error" | "fatal" | "info" | "silent" | "trace" | "warn";
  refreshTokenExpiresInDays: number;
  serviceName: string;
};

const EnvSchema: z.ZodType<Env> = z.object({
  accessTokenExpiresInSeconds: z.coerce.number().int().positive().default(900),
  apiPort: z.coerce.number().int().positive().default(3000),
  databaseUrl: z
    .url()
    .default("postgres://postgres:postgres@localhost:5432/appdb"),
  environment: z
    .enum(["development", "production", "test"])
    .default("development"),
  jwtAccessTokenSecret: z
    .string()
    .min(32)
    .default("ticketflow-development-access-token-secret"),
  logLevel: z
    .enum(["debug", "error", "fatal", "info", "silent", "trace", "warn"])
    .default("info"),
  refreshTokenExpiresInDays: z.coerce.number().int().positive().default(30),
  serviceName: z.string().min(1).default("ticketflow-api"),
});

export const env: Env = EnvSchema.parse({
  accessTokenExpiresInSeconds: process.env["ACCESS_TOKEN_EXPIRES_IN_SECONDS"],
  apiPort: process.env["API_PORT"],
  databaseUrl: process.env["DATABASE_URL"],
  environment: process.env["NODE_ENV"],
  jwtAccessTokenSecret: process.env["JWT_ACCESS_TOKEN_SECRET"],
  logLevel: process.env["LOG_LEVEL"],
  refreshTokenExpiresInDays: process.env["REFRESH_TOKEN_EXPIRES_IN_DAYS"],
  serviceName: process.env["SERVICE_NAME"],
});
