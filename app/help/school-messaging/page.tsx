import SchoolMessagingGuide from '../SchoolMessagingGuide';
import s from './messaging.module.css';
export const metadata={title:'School messaging setup | SpaceCase'};
export default function Page(){return <main className={s.page}><nav aria-label='Messaging help navigation'><a href='/onboarding/school'>School registration</a><a href='/admin'>School administration</a><a href='/login'>Sign in</a></nav><h1>Reach parents with confidence</h1><p>A short guide to preparing your school’s email and WhatsApp invitations.</p><SchoolMessagingGuide/></main>;}
