import {redirect} from 'next/navigation';import {currentSession} from '../../platform/auth/currentSession';import {schoolNoticesEnabled} from '../../platform/notices/authority';import NoticeBoard from './NoticeBoard';
export const dynamic='force-dynamic';export const metadata={title:'School notice board | SpaceCase'};
export default async function Page(){if(!schoolNoticesEnabled())return <main><h1>School notice board is being prepared</h1><a href='/dashboard'>Staff workspace</a></main>;if(!await currentSession())redirect('/login');return <NoticeBoard/>;}
