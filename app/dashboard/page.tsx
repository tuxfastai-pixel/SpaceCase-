import DashboardClient from "./DashboardClient";
import { currentSession } from "../../platform/auth/currentSession";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { adminSchools } from "../../platform/admin/peosProxy";
import { PEOS_SESSION_COOKIE } from "../../platform/session/peosAuthorization";

export default async function DashboardPage() {
  if (!await currentSession()) redirect("/login");
  const token = (await cookies()).get(PEOS_SESSION_COOKIE)?.value;
  if (token && (await adminSchools(`Bearer ${token}`)).length) redirect("/admin");
  return <DashboardClient />;
}
