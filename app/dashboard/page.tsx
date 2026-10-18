import DashboardClient from "./DashboardClient";
import { currentSession } from "../../platform/auth/currentSession";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  if (!await currentSession()) redirect("/login");
  return <DashboardClient />;
}
