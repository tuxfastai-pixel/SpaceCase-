import SchoolNoticeLink from '@/app/ui/SchoolNoticeLink';
import noticeStyles from '@/app/ui/noticesEntry.module.css';
import {familyInvitationsEnabled} from '@/platform/family/invitationConfig';
import {redirect} from "next/navigation";
import {currentSession} from "@/platform/auth/currentSession";
import RosterClient from "@/app/roster/RosterClient";
import {z} from "zod";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{schoolId:string;classId:string}>}){
 if(!await currentSession())redirect("/login");
 const p=z.object({schoolId:z.string().uuid(),classId:z.string().uuid()}).parse(await params);
 return <><nav className={noticeStyles.shortcut} aria-label='School communication'><SchoolNoticeLink schoolId={p.schoolId}/></nav><RosterClient schoolId={p.schoolId} classId={p.classId} admin={true} familyInvitations={familyInvitationsEnabled()}/></>;
}
