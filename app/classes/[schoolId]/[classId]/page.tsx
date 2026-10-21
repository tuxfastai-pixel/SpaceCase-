import {redirect} from "next/navigation";
import {currentSession} from "@/platform/auth/currentSession";
import RosterClient from "@/app/roster/RosterClient";
import {z} from "zod";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{schoolId:string;classId:string}>}){
 if(!await currentSession())redirect("/login");
 const p=z.object({schoolId:z.string().uuid(),classId:z.string().uuid()}).parse(await params);
 return <RosterClient schoolId={p.schoolId} classId={p.classId} admin={false}/>;
}
