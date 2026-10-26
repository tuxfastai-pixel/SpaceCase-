import {redirect} from 'next/navigation';import {currentSession} from '../../platform/auth/currentSession';import ParentHome from './ParentHome';
export const metadata={title:'Parent and caregiver workspace | SpaceCase'};export const dynamic='force-dynamic';
export default async function Page(){if(!await currentSession())redirect('/login?onboarding=parent');return <ParentHome/>;}
