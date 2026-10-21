import {redirect} from "next/navigation";
import {currentSession} from "@/platform/auth/currentSession";
import OperationsClient from "./OperationsClient";
export const dynamic="force-dynamic";
export default async function Page(){const session=await currentSession();if(!session)redirect("/login");return <OperationsClient personId={session.personId}/>;}
