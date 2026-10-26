import { redirect } from "next/navigation";
import { currentSession } from "@/platform/auth/currentSession";
import AdminClient from "./AdminClient";

export const dynamic="force-dynamic";
export default async function AdminPage({searchParams}:{searchParams:Promise<{school?:string}>}) {
  if (!await currentSession()) redirect("/login");
  const q=await searchParams;return <AdminClient initialSchool={q.school} />;
}
