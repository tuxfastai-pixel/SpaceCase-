import {redirect} from "next/navigation";
import {currentSession} from "@/platform/auth/currentSession";
import SupportClient from "./SupportClient";
import {pilotIssueTitle} from "../../domains/pilot/checklist";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<{area?:string;pilotCheck?:string}>}){if(!await currentSession())redirect("/login");const q=await searchParams;return <SupportClient initialArea={q.area} initialTitle={pilotIssueTitle(q.pilotCheck)}/>;}
