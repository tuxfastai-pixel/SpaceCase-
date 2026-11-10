import { supportAuthority } from "../../platform/support/authority";
import { workspaceDestination } from "../../platform/auth/workspaceDestination";
import {financeSchools} from "../../platform/finance/peosAuthorization";
import DashboardClient from "./DashboardClient";
import { currentSession } from "../../platform/auth/currentSession";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { adminSchools } from "../../platform/admin/peosProxy";
import { PEOS_SESSION_COOKIE } from "../../platform/session/peosAuthorization";

export const metadata={title:'Your workspace | SpaceCase'};
export const dynamic="force-dynamic";

export default async function DashboardPage() {
  if (!await currentSession()) redirect("/login");
  const token = (await cookies()).get(PEOS_SESSION_COOKIE)?.value;
  if (token) {
    const authorization = `Bearer ${token}`;
    const deploymentToken = process.env.VERCEL_ENV === "preview" ? (await headers()).get("x-vercel-oidc-token") : null;
    const trustedFetch: typeof fetch = (input, init) => fetch(input, {
      ...init,
      headers: {
        ...Object.fromEntries(new Headers(init?.headers).entries()),
        ...(deploymentToken ? { "x-vercel-trusted-oidc-idp-token": deploymentToken } : {}),
      },
    });
    let destination;
    try{destination = await workspaceDestination(
      () => supportAuthority(new Request("https://spacecase.invalid", { headers: { authorization, ...(deploymentToken ? { "x-vercel-oidc-token": deploymentToken } : {}) } })),
      () => adminSchools(authorization, trustedFetch),
      async () => (await financeSchools(authorization, trustedFetch)).schools,
    );
    }catch{return <main><h1>Your workspace could not be checked</h1><p>We could not confirm your current role. Refresh or choose your intended Google account.</p><a href="/dashboard">Try again</a><form action="/auth/google?choose_account=1" method="post"><button>Use another Google account</button></form></main>;}
    if (destination) redirect(destination);
  }
  return <DashboardClient />;
}
