import NoticesEntry from '@/app/ui/NoticesEntry';
import noticeStyles from '@/app/ui/noticesEntry.module.css';
import {redirect} from 'next/navigation';
import {currentSession} from '../../../platform/auth/currentSession';
import FamilyOnboarding from './FamilyOnboarding';
export const metadata={title:'Set up your family profile | SpaceCase'};
export default async function FamilyOnboardingPage(){if(!await currentSession())redirect('/login');return <><nav className={noticeStyles.shortcut} aria-label='Family communication'><NoticesEntry/></nav><FamilyOnboarding/></>;}
