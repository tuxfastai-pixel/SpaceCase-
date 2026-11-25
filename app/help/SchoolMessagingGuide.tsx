import HelpCard from './HelpCard';
import s from './school-messaging/messaging.module.css';

export default function SchoolMessagingGuide({compact=false}:{compact?:boolean}){
 return <section className={s.guide} aria-label='School messaging guide'>
 <p className={s.eyebrow}>Keep families connected</p><h2>School messaging</h2>
 <p>Help parents recognise your school, receive their invitation and know where to reply. Prepare your school contacts now; you can complete messaging setup after your school is verified.</p>
 <p className={s.status}><strong>Available now:</strong> create a private invitation and share it yourself by email or WhatsApp. <strong>Automatic sending is not connected yet.</strong></p>
 <HelpCard title='Why set this up?' description='Less chasing, recognisable messages and one place to follow invitations.'>
 <p>Parents should receive a clear message from a school they recognise. With automatic sending, your team will be able to review a list once, send individual invitations and follow their progress without copying every message.</p>
 <p>Saving a school phone number or email does not connect a sending account. Parents still use their own invited account, and the school checks their connection separately.</p>
 </HelpCard>
 {compact?<p><a className={s.link} href='/help/school-messaging'>See the school messaging checklist →</a></p>:<>
 <div className={s.channels}>
 <article><h3>Email invitations</h3><p className={s.badge}>Manual sharing available · Automatic delivery planned</p><p>The planned sender name is <strong>“Your School via SpaceCase”</strong>. SpaceCase will manage delivery, with replies directed to your school’s agreed inbox.</p><p><strong>Prepare:</strong> an email inbox your school checks regularly and the staff member responsible for replies. Your school’s own sending domain can be an optional later setup.</p></article>
 <article><h3>WhatsApp invitations</h3><p className={s.badge}>Manual sharing available · Business number setup planned</p><p>Manual sharing uses the WhatsApp account of the person who presses Send. Automatic sending will use a business number connected specifically to your school.</p><p><strong>Prepare:</strong> a school-controlled number and a staff member authorised to complete business verification. We will explain the supported connection options before you change an existing number.</p></article>
 </div>
 <h3>Your setup journey</h3><ol className={s.steps}>
 <li><strong>Register your school.</strong> Add the school’s contact email and phone to School details. These are contact details, not connected senders. Registration can continue while automatic sending is unavailable.</li>
 <li><strong>Confirm school authority.</strong> The principal or authorised school administrator completes the required school review before connecting messaging accounts.</li>
 <li><strong>Connect your senders — coming later.</strong> Follow the guided email and WhatsApp business setup. You will see what needs verification and who needs to complete it.</li>
 <li><strong>Check parent contact permission.</strong> Confirm which parents expect school messages and their preferred channel. Keep each parent’s invitation private.</li>
 <li><strong>Try one invitation.</strong> Check the sender name, receipt, link opening, parent sign-in and acceptance. Check replies reach the correct school team.</li>
 <li><strong>Switch on automatic sending — after approval.</strong> Only after account checks, message approval where required and a successful trial. Automatic delivery will remain off until the setup is ready.</li>
 </ol>
 <HelpCard title='What will the setup statuses mean?' description='A clear next action for each stage, without guessing whether messages were sent.'>
 <dl><dt>Not started</dt><dd>Choose the school’s sender and responsible staff member.</dd><dt>Needs your attention</dt><dd>A contact detail or verification step is missing. The guide will name the next action.</dd><dt>Waiting for approval</dt><dd>The messaging provider is checking the account or message. No approval time is promised.</dd><dt>Ready to test</dt><dd>Send a private trial to your nominated test recipient.</dd><dt>Automatic sending enabled</dt><dd>The connected service has passed its checks and the authorised school user has enabled it.</dd></dl>
 <p>These describe the planned setup journey. They are not a live connection check for your school.</p>
 </HelpCard>
 <HelpCard title='Where do replies and updates go?' description='Each school keeps its own conversations and invitation progress.'><p>Email replies will go to the school inbox agreed during setup. WhatsApp replies will belong to that school’s connected number and authorised team. Staff will see sending, delivery and acceptance as separate steps; delivery alone does not confirm a parent’s connection.</p><p>Bulk parent uploads, automatic reminders and the connected reply inbox are still being built. Until then, use your established school communication channels.</p></HelpCard>
 <p><a href='/admin'>Open school administration</a> · <a href='/help/parents'>Read the parent guide</a></p>
 </>}
 <p className={s.note}>Need a hand? Open the explanations with a click, tap or keyboard. Nothing on this guide connects an account, sends a message or grants school access.</p>
 </section>;
}
