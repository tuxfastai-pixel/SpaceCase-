import { redirect } from "next/navigation";
import { currentSession } from "@/platform/auth/currentSession";
import AdminClient from "./AdminClient";

export default async function AdminPage() {
  if (!await currentSession()) redirect("/login");
  return <AdminClient />;
}
