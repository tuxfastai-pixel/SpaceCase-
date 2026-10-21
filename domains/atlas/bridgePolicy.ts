export type AtlasBridgeAuthority = {
  atlasEntitlementActive: boolean;
  guardianConsentActive: boolean;
  educatorAuthorized: boolean;
  purposePermitted: boolean;
  contractVersionCurrent: boolean;
};

export type AtlasBridgeDecision = { allowed: true; reason: "bridge_authorized" } | { allowed: false; reason: string };

export function authorizeAtlasBridge(authority: AtlasBridgeAuthority): AtlasBridgeDecision {
  if (!authority.atlasEntitlementActive) return { allowed: false, reason: "atlas_entitlement_inactive" };
  if (!authority.guardianConsentActive) return { allowed: false, reason: "guardian_consent_missing" };
  if (!authority.educatorAuthorized) return { allowed: false, reason: "educator_not_authorized" };
  if (!authority.purposePermitted) return { allowed: false, reason: "purpose_not_permitted" };
  if (!authority.contractVersionCurrent) return { allowed: false, reason: "contract_version_not_current" };
  return { allowed: true, reason: "bridge_authorized" };
}
