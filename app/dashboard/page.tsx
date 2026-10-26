import { supportAuthority } from "../../platform/support/authority";
import { workspaceDestination } from "../../platform/auth/workspaceDestination";
import DashboardClient from "./DashboardClient";
import { currentSession } from "../../platform/auth/currentSession";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { adminSchools } from "../../platform/admin/peosProxy";
import { PEOS_SESSION_COOKIE } from "../../platform/session/peosAuthorization";

export const metadata={title:'Your workspace | SpaceCase'};
export const dynamic="force-dynamic";

export default async function DashboardPage() {
  if (!await currentSession()) redirect("/login");
  const token = (await cookies()).get(PEOS_SESSION_COOKIE)?.value;
  if (token) {
    const authorization = `Bearer ${token}`;
    let destination;
    try{destination = await workspaceDestination(
      () => supportAuthority(new Request("https://spacecase.invalid", { headers: { authorization } })),
      () => adminSchools(authorization),
    );
    }catch{return <main><h1>Your workspace could not be checked</h1><p>We could not confirm your current role. Refresh or choose your intended Google account.</p><a href="/dashboard">Try again</a><form action="/auth/google?choose_account=1" method="post"><button>Use another Google account</button></form></main>;}
    if (destination) redirect(destination);
  }
  return <DashboardClient />;
}
