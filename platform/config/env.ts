import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1).optional(),
  PEOS_BASE_URL: z.string().url().optional(),
  PSG_AI_BASE_URL: z.string().url().optional(),
  ATLAS_BASE_URL: z.string().url().optional(),
});

export type ServerEnvironment = z.infer<typeof serverEnvSchema>;

export function readServerEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): ServerEnvironment {
  return serverEnvSchema.parse(source);
}
