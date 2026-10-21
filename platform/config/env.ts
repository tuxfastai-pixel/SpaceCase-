import { z } from "zod";

const optionalNonBlank = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    schema.optional(),
  );

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: optionalNonBlank(z.string().min(1)),
  PEOS_BASE_URL: optionalNonBlank(z.string().url()),
  PSG_AI_BASE_URL: optionalNonBlank(z.string().url()),
  ATLAS_BASE_URL: optionalNonBlank(z.string().url()),
  SUPABASE_URL: optionalNonBlank(z.string().url()),
  SUPABASE_PUBLISHABLE_KEY: optionalNonBlank(z.string().min(1)),
  SPACECASE_PUBLIC_URL: optionalNonBlank(z.string().url()),
  SPACECASE_WORKSPACE_MODE: z.enum(["operational","authority_only"]).default("operational"),
});

export type ServerEnvironment = z.infer<typeof serverEnvSchema>;

export function readServerEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): ServerEnvironment {
  return serverEnvSchema.parse(source);
}
