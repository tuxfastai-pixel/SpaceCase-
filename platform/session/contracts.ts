export type AuthenticatedSession = {
  sessionId: string;
  personId: string;
  issuedAt: string;
  expiresAt: string;
};

export interface SessionResolver {
  resolve(request: Request): Promise<AuthenticatedSession | null>;
}

export class UnavailableSessionResolver implements SessionResolver {
  async resolve(_request: Request): Promise<AuthenticatedSession | null> {
    void _request;
    return null;
  }
}
