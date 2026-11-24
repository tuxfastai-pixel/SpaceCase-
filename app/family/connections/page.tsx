import NoticesEntry from '@/app/ui/NoticesEntry';
import noticeStyles from '@/app/ui/noticesEntry.module.css';
import {redirect} from 'next/navigation';import {currentSession} from '@/platform/auth/currentSession';import {familyInvitationsEnabled} from '@/platform/family/invitationConfig';import Connections from './Connections';
export const dynamic='force-dynamic';
export default async function Page(){if(!await currentSession())redirect('/login');if(!familyInvitationsEnabled())return <main><h1>School connections</h1><p>School connections are not activated yet.</p><a href='/family/onboarding'>Family setup</a></main>;return <><nav className={noticeStyles.shortcut} aria-label='Family communication'><NoticesEntry/></nav><Connections/></>;}
