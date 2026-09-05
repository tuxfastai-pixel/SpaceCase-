export type AtlasOnboardingAuthority = {
  guardianGrantActive: boolean;
  grantPurpose: "ATLAS_ACCELERATED_ONBOARDING" | "OTHER";
  grantVersionCurrent: boolean;
  teacherAuthorized: boolean;
};

export function authorizeAcceleratedAtlasOnboarding(authority: AtlasOnboardingAuthority): boolean {
  return authority.guardianGrantActive
    && authority.grantPurpose === "ATLAS_ACCELERATED_ONBOARDING"
    && authority.grantVersionCurrent
    && authority.teacherAuthorized;
}
