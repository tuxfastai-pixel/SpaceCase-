import {redirect} from 'next/navigation';
import {currentSession} from '../../platform/auth/currentSession';
import DashboardClient from '../dashboard/DashboardClient';
export const dynamic='force-dynamic';
export const metadata={title:'Teacher workspace | SpaceCase'};
/** Explicit teacher intent never selects a different role; context API retains authority. */
export default async function TeacherPage(){if(!await currentSession())redirect('/login?onboarding=teacher');return <DashboardClient teacherIntent/>;}
