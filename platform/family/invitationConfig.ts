export const FAMILY_INVITATION_COOKIE='spacecase_family_invitation';
// Preview pilot fallback: Vercel's branch-scoped setting may not be available on manually triggered deployments.
// This activates only the designated Preview feature branch; PEOS still enforces school roles and independent review.
export function familyInvitationsEnabled(){
  return process.env.SPACECASE_FAMILY_INVITATIONS_ENABLED==='true' ||
    (process.env.VERCEL_ENV==='preview' && process.env.VERCEL_GIT_COMMIT_REF==='feature/finance-workspace-completion');
}
