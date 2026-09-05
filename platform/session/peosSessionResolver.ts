import { z } from "zod";

import type { AuthenticatedSession, SessionResolver } from "./contracts";
import { resolvePeosAuthorization } from "./peosAuthorization";

const sessionResponseSchema = z.object({
  session: z.object({
    sessionId: z.string().min(1),
    personId: z.string().min(1),
    issuedAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
  }),
});

export class PeosSessionResolver implements SessionResolver {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async resolve(request: Request): Promise<AuthenticatedSession | null> {
    const authorization = resolvePeosAuthorization(request);
    if (!authorization) return null;

    const response = await this.fetchImpl(
      new URL("/v1/sessions/introspect", this.baseUrl),
      {
        method: "POST",
        headers: {
          authorization,
          accept: "application/json",
        },
      },
    );

    if (response.status === 401 || response.status === 403) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`PEOS session introspection failed: ${response.status}`);
    }

    const parsed = sessionResponseSchema.parse(await response.json());
    return parsed.session;
  }
}
