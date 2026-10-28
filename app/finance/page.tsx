import {redirect} from 'next/navigation';import {currentSession} from '@/platform/auth/currentSession';import FinanceClient from './FinanceClient';import {financeId} from '@/domains/school-finance/contracts';
export const metadata={title:'School finance | SpaceCase'};export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{school?:string}>}){if(!await currentSession())redirect('/login');const q=await searchParams;const school=financeId.safeParse(q.school);return <FinanceClient initialSchool={school.success?school.data:''}/>;}
