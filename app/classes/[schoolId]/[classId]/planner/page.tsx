import {redirect} from "next/navigation";
import {z} from "zod";
import {currentSession} from "@/platform/auth/currentSession";
import PlannerClient from "@/app/planner/PlannerClient";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{schoolId:string;classId:string}>}){
 if(!await currentSession())redirect("/login");
 const p=z.object({schoolId:z.string().uuid(),classId:z.string().uuid()}).parse(await params);
 return <PlannerClient schoolId={p.schoolId} classId={p.classId}/>;
}
