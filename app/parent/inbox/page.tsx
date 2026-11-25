import {schoolNoticesEnabled} from '../../../platform/notices/authority';
import {redirect} from 'next/navigation';import {z} from 'zod';import {currentSession} from '../../../platform/auth/currentSession';import {parentInboxEnabled} from '../../../platform/communications/authority';import ParentInbox from './ParentInbox';
export const dynamic='force-dynamic';export const metadata={title:'Notices & messages | SpaceCase'};
export default async function Page({searchParams}:{searchParams:Promise<{notice?:string;thread?:string}>}){
 if(!parentInboxEnabled()&&!schoolNoticesEnabled())return <main><h1>Notices and messages are being prepared</h1><a href='/parent'>Family workspace</a></main>;
 const input=z.object({notice:z.string().uuid().toLowerCase().optional(),thread:z.string().uuid().toLowerCase().optional()}).strict().refine(v=>!v.notice||!v.thread).safeParse(await searchParams);
 if(!input.success)return <main><h1>This notice link could not be opened</h1><a href='/parent/inbox'>Open notices and messages</a></main>;
 const target=`/parent/inbox${input.data.notice?`?notice=${input.data.notice}`:input.data.thread?`?thread=${input.data.thread}`:''}`;
 if(!await currentSession())redirect(`/login?onboarding=parent&returnTo=${encodeURIComponent(target)}`);
 return <ParentInbox boardEnabled={schoolNoticesEnabled()} financeEnabled={parentInboxEnabled()} initialNotice={input.data.notice} initialThread={input.data.thread}/>;
}
