import { z } from "zod";

type Env = {
  port: number;
};

const EnvSchema: z.ZodType<Env> = z.object({
  port: z.coerce.number().int().positive().default(3000),
});

export const env: Env = EnvSchema.parse({
  port: process.env["PORT"],
});
