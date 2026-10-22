import {redirect} from "next/navigation";
import {z} from "zod";
import {currentSession} from "@/platform/auth/currentSession";
import HomeworkClient from "@/app/homework/HomeworkClient";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{schoolId:string;classId:string}>}){
 if(!await currentSession())redirect("/login");
 const p=z.object({schoolId:z.string().uuid(),classId:z.string().uuid()}).parse(await params);
 return <HomeworkClient schoolId={p.schoolId} classId={p.classId}/>;
}
