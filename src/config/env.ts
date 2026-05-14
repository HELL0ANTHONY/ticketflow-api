import { z } from "zod";

type Env = {
  databaseUrl: string;
  apiPort: number;
};

const EnvSchema: z.ZodType<Env> = z.object({
  databaseUrl: z
    .url()
    .default("postgres://postgres:postgres@localhost:5432/appdb"),
  apiPort: z.coerce.number().int().positive().default(3000),
});

export const env: Env = EnvSchema.parse({
  databaseUrl: process.env["DATABASE_URL"],
  apiPort: process.env["API_PORT"],
});
