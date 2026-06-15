import { z } from "zod";

type Env = {
  accessTokenExpiresInSeconds: number;
  apiPort: number;
  databaseUrl: string;
  environment: "development" | "production" | "test";
  jwtAccessTokenSecret: string;
  logLevel: "debug" | "error" | "fatal" | "info" | "silent" | "trace" | "warn";
  metricsEnabled: boolean;
  otelTraceExporterUrl: string;
  refreshTokenExpiresInDays: number;
  serviceName: string;
  tracingEnabled: boolean;
};

const booleanStringSchema = z
  .union([z.boolean(), z.enum(["0", "1", "false", "true"])])
  .transform((value) => {
    if (typeof value === "boolean") {
      return value;
    }

    return value === "true" || value === "1";
  });

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
  metricsEnabled: booleanStringSchema.default(true),
  otelTraceExporterUrl: z
    .url()
    .default("http://localhost:4318/v1/traces"),
  refreshTokenExpiresInDays: z.coerce.number().int().positive().default(30),
  serviceName: z.string().min(1).default("ticketflow-api"),
  tracingEnabled: booleanStringSchema.default(false),
});

export const env: Env = EnvSchema.parse({
  accessTokenExpiresInSeconds: process.env["ACCESS_TOKEN_EXPIRES_IN_SECONDS"],
  apiPort: process.env["API_PORT"],
  databaseUrl: process.env["DATABASE_URL"],
  environment: process.env["NODE_ENV"],
  jwtAccessTokenSecret: process.env["JWT_ACCESS_TOKEN_SECRET"],
  logLevel: process.env["LOG_LEVEL"],
  metricsEnabled: process.env["METRICS_ENABLED"],
  otelTraceExporterUrl: process.env["OTEL_TRACE_EXPORTER_URL"],
  refreshTokenExpiresInDays: process.env["REFRESH_TOKEN_EXPIRES_IN_DAYS"],
  serviceName: process.env["SERVICE_NAME"],
  tracingEnabled: process.env["TRACING_ENABLED"],
});
