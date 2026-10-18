import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { readServerEnvironment } from "../config/env";

export function authConfiguration() {
  const env = readServerEnvironment();
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY || !env.SPACECASE_PUBLIC_URL) {
    throw new Error("Sign-in configuration unavailable");
  }
  const origin = new URL(env.SPACECASE_PUBLIC_URL).origin;
  if (env.NODE_ENV === "production" && !origin.startsWith("https://")) {
    throw new Error("HTTPS is required for sign-in");
  }
  return { url: env.SUPABASE_URL, key: env.SUPABASE_PUBLISHABLE_KEY, origin };
}

export async function createAuthClient() {
  const config = authConfiguration();
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) => { for (const { name, value, options } of values) jar.set(name, value, options); },
    },
  });
}
