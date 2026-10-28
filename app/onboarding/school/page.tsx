import {redirect} from 'next/navigation';import {currentSession} from '@/platform/auth/currentSession';import SchoolRegistration from './SchoolRegistration';
export const metadata={title:'Register your school | SpaceCase'};export const dynamic='force-dynamic';
export default async function Page(){if(!await currentSession())redirect('/login');return <SchoolRegistration/>;}
