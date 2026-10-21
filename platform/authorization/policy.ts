export type AuthorizationDecision =
  | { allowed: true; reason: string; policyVersion: string }
  | { allowed: false; reason: string; policyVersion: string };

export type AuthorizationRequest = {
  actorPersonId: string;
  action: string;
  schoolId?: string;
  learnerPersonId?: string;
  classId?: string;
  resourceId?: string;
};

export interface AuthorizationPolicy {
  decide(request: AuthorizationRequest): Promise<AuthorizationDecision>;
}
