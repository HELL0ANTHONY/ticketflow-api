import { z } from "zod";

type Env = {
  accessTokenExpiresInSeconds: number;
  apiPort: number;
  databaseUrl: string;
  jwtAccessTokenSecret: string;
  refreshTokenExpiresInDays: number;
};

const EnvSchema: z.ZodType<Env> = z.object({
  accessTokenExpiresInSeconds: z.coerce.number().int().positive().default(900),
  apiPort: z.coerce.number().int().positive().default(3000),
  databaseUrl: z
    .url()
    .default("postgres://postgres:postgres@localhost:5432/appdb"),
  jwtAccessTokenSecret: z
    .string()
    .min(32)
    .default("ticketflow-development-access-token-secret"),
  refreshTokenExpiresInDays: z.coerce.number().int().positive().default(30),
});

export const env: Env = EnvSchema.parse({
  accessTokenExpiresInSeconds: process.env["ACCESS_TOKEN_EXPIRES_IN_SECONDS"],
  apiPort: process.env["API_PORT"],
  databaseUrl: process.env["DATABASE_URL"],
  jwtAccessTokenSecret: process.env["JWT_ACCESS_TOKEN_SECRET"],
  refreshTokenExpiresInDays: process.env["REFRESH_TOKEN_EXPIRES_IN_DAYS"],
});
