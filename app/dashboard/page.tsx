import { supportAuthority } from "../../platform/support/authority";
import { workspaceDestination } from "../../platform/auth/workspaceDestination";
import DashboardClient from "./DashboardClient";
import { currentSession } from "../../platform/auth/currentSession";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { adminSchools } from "../../platform/admin/peosProxy";
import { PEOS_SESSION_COOKIE } from "../../platform/session/peosAuthorization";

export default async function DashboardPage() {
  if (!await currentSession()) redirect("/login");
  const token = (await cookies()).get(PEOS_SESSION_COOKIE)?.value;
  if (token) {
    const authorization = `Bearer ${token}`;
    const destination = await workspaceDestination(
      () => supportAuthority(new Request("https://spacecase.invalid", { headers: { authorization } })),
      () => adminSchools(authorization),
    );
    if (destination) redirect(destination);
  }
  return <DashboardClient />;
}
