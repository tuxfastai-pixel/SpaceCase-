import {redirect} from "next/navigation";
import {currentSession} from "@/platform/auth/currentSession";
import SupportClient from "./SupportClient";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<{area?:string}>}){if(!await currentSession())redirect("/login");const q=await searchParams;return <SupportClient initialArea={q.area}/>;}
