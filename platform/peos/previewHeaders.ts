/** Deployment access is separate from PEOS user authentication/authorization.
 * Preview-only fallback for accounts without cross-project Trusted Sources.
 * Never import this server helper into client components or expose its env value.
 */
export function peosPreviewHeaders(deploymentToken: string | null): Record<string,string> {
  if (process.env.VERCEL_ENV !== "preview") return {};
  const bypass = process.env.PEOS_PREVIEW_PROTECTION_BYPASS?.trim();
  return {
    ...(deploymentToken ? {"x-vercel-trusted-oidc-idp-token": deploymentToken} : {}),
    ...(bypass ? {"x-vercel-protection-bypass": bypass} : {}),
  };
}
