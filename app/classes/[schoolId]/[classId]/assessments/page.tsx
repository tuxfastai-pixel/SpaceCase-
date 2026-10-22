import {redirect} from "next/navigation";
import {z} from "zod";
import {currentSession} from "@/platform/auth/currentSession";
import AssessmentClient from "@/app/assessments/AssessmentClient";
export const dynamic="force-dynamic";
export default async function Page({params,searchParams}:{params:Promise<{schoolId:string;classId:string}>;searchParams:Promise<{assessment?:string}>}){
 if(!await currentSession())redirect("/login");
 const p=z.object({schoolId:z.string().uuid(),classId:z.string().uuid()}).parse(await params);
 const q=z.string().uuid().safeParse((await searchParams).assessment);
 return <AssessmentClient schoolId={p.schoolId} classId={p.classId} initialId={q.success?q.data:""}/>;
}
