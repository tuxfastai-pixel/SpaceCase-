import {redirect} from "next/navigation";
import {z} from "zod";
import {currentSession} from "@/platform/auth/currentSession";
import FounderClient from "./FounderClient";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<{school?:string}>}){if(!await currentSession())redirect("/login");const q=await searchParams;const school=z.string().uuid().safeParse(q.school);return <FounderClient initialSchool={school.success?school.data:""}/>;}
