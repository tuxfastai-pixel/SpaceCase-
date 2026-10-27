import WorkspaceIcon from '../ui/WorkspaceIcon';
import s from './parentHome.module.css';

export default function ParentHome(){
 return <main className={s.page}>
  <header className={s.topbar}><div><a className={s.brand} href='/parent'>SpaceCase</a><span>Parent / caregiver workspace</span></div><nav aria-label='Account'><a href='/dashboard'>My assigned workspace</a><form action='/auth/google?choose_account=1' method='post'><input type='hidden' name='onboarding' value='parent'/><button>Use another Google account</button></form><form action='/auth/logout' method='post'><button>Sign out</button></form></nav></header>
  <div className={s.content}><section className={s.hero}><p className={s.eyebrow}>A place for your family</p><h1>Your family workspace</h1><p>Keep your family setup in one place and follow your school connection when you are ready.</p></section>
  <nav className={s.quickNav} aria-label='Family workspace sections'><a href='#family-profile'><WorkspaceIcon name='family'/>Family profile</a><a href='#school-connection'><WorkspaceIcon name='school'/>School connection</a><a href='/help/parents'><WorkspaceIcon name='help'/>Help & examples</a><a href='/pilot'><WorkspaceIcon name='overview'/>Pilot guide</a></nav>
  <p className={s.intro}>You can begin without a school invitation. Your setup is private; a child’s school records need a separately verified connection and permission.</p>
  <div className={s.grid}><section className={s.card} id='family-profile'><WorkspaceIcon name='family'/><p className={s.eyebrow}>Your family</p><h2>Family profile</h2><p>Enter your contact details, your child’s names, birth date and profile photo. A second parent is optional. A short medical note is optional and remains in your private draft.</p><a className={s.primary} href='/family/onboarding'>Start / continue family setup <span aria-hidden='true'>→</span></a></section>
  <section className={s.card} id='school-connection'><WorkspaceIcon name='connection'/><p className={s.eyebrow}>Your school</p><h2>Connect with the school</h2><p>Ask the school to invite the email you use here. Accepting the invitation requests school review. Choosing Parent or saving a draft does not identify a school learner or prove guardianship.</p><a className={s.secondary} href='/family/connections'>My school connections <span aria-hidden='true'>→</span></a></section></div>
  <section className={s.notice}><WorkspaceIcon name='today'/><div><h2>What’s coming next</h2><p>Draft submission, parent reports, attendance, homework and shared correspondence photos are still being completed. No child records or school messages are created merely by opening this workspace.</p></div></section>
  <p className={s.footer}>If your parent-only account cannot submit a school support ticket, contact your school pilot coordinator. They can log the issue through their authorized staff account without sharing private family details.</p></div>
 </main>;
}
