export type RevocableAuthority = {
  sessionActive: boolean;
  consentActive: boolean;
  entitlementActive: boolean;
};

export function authorityRemainsActive(authority: RevocableAuthority): boolean {
  return authority.sessionActive && authority.consentActive && authority.entitlementActive;
}
