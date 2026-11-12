import { peosPreviewHeaders } from "../../platform/peos/previewHeaders";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { currentSession } from "../../platform/auth/currentSession";
import { PEOS_SESSION_COOKIE } from "../../platform/session/peosAuthorization";
import { financeSchools } from "../../platform/finance/peosAuthorization";
import FinanceClient from "./FinanceClient";
export const metadata = { title: "School finance | SpaceCase" };
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ school?: string }>;
}) {
  if (!(await currentSession())) redirect("/login");
  const token = (await cookies()).get(PEOS_SESSION_COOKIE)?.value;
  if (!token) {
    return (
      <main>
        <h1>Finance session required</h1>
        <p>Your school session is missing. Sign in again before accessing financial information.</p>
        <a href="/login">Sign in</a>
      </main>
    );
  }
  let directory;
  try {
    const deploymentToken = process.env.VERCEL_ENV === "preview"
      ? (await headers()).get("x-vercel-oidc-token")
      : null;
    const trustedFetch: typeof fetch = (input, init) => fetch(input, {
      ...init,
      headers: {
        ...Object.fromEntries(new Headers(init?.headers).entries()),
        ...peosPreviewHeaders(deploymentToken),
      },
    });
    directory = await financeSchools(`Bearer ${token}`, trustedFetch);
  } catch {
    return (
      <main>
        <h1>Finance access could not be checked</h1>
        <p>Refresh or use your intended school account.</p>
        <a href="/dashboard">My workspace</a>
      </main>
    );
  }
  if (!directory.schools.length)
    return (
      <main>
        <h1>School finance access required</h1>
        <p>
          Your current account has no active principal or finance assignment.
          School administration access alone does not grant financial access.
        </p>
        <a href="/dashboard">My workspace</a>
      </main>
    );
  const q = await searchParams,
    initial = directory.schools.some((s) => s.id === q.school)
      ? q.school!
      : directory.schools[0].id;
  return (
    <FinanceClient
      schools={directory.schools}
      initialSchool={initial}
      enabled={
        process.env.SPACECASE_FINANCE_WORKSPACE_ENABLED === "true" &&
        process.env.SPACECASE_WORKSPACE_MODE !== "authority_only"
      }
      directoryTruncated={directory.truncated}
    />
  );
}
