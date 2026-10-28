"use client";
import { useCallback, useEffect, useState } from "react";
import AdministratorHelp, {AdministratorGuide} from "../help/AdministratorHelp";
import styles from "./admin.module.css";
import WorkspaceIcon from "../ui/WorkspaceIcon";
import InvitationShare from "./InvitationShare";
import { prepareInvitationMessage, type InvitationMessage } from "../../platform/invitations/message";
import ClassManager from "./ClassManager";
import BulkInvitations from "./BulkInvitations";
import BillingPanel from "../billing/BillingPanel";
import WorkspaceSetup from "./WorkspaceSetup";
import SchoolDetails from "./SchoolDetails";
import WorkspaceSwitcher from "../workspace/WorkspaceSwitcher";

type School = { id: string; displayName: string; principal?:boolean };
type Invite = { id: string; email: string; roleCode: string; expiresAt: string; acceptedAt: string | null; revokedAt: string | null };
const errors: Record<string, string> = {
  SCHOOL_PRINCIPAL_REQUIRED: "Only a currently assigned principal can appoint school administrators. Ask the principal to create this invitation.",
  SCHOOL_ADMIN_REQUIRED: "You don’t have administrator access to this school.",
  INVITATION_ALREADY_PENDING: "An invitation is already pending for this email. Revoke it before creating a replacement.",
  UNAUTHENTICATED: "Your session has ended. Please sign in again.",
  INVALID_INPUT: "Check the school name or email address and try again.",
  INVITATION_UNAVAILABLE: "This invitation is no longer available. Refresh the list or create a new invitation.",
};
async function api<T>(path: string, method = "GET", body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { method, body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json" }, credentials: "same-origin", cache: "no-store", signal });
  const data = await response.json();
  if (!response.ok) throw new Error(Object.hasOwn(errors, data.error) ? errors[data.error] : "We couldn’t complete that action. Please try again.");
  return data as T;
}
const roleName = (role: string) => role === "SCHOOL_ADMINISTRATOR" ? "School administrator" : "Teacher";
const inviteStatus = (i: Invite) => i.acceptedAt ? "Accepted" : i.revokedAt ? "Revoked" : Date.parse(i.expiresAt) <= Date.now() ? "Expired" : "Pending";

export default function AdminClient({initialSchool}:{initialSchool?:string}) {
  const [schools, setSchools] = useState<School[] | null>(null);
  const [schoolId, setSchoolId] = useState("");
  const [schoolDetailsDirty, setSchoolDetailsDirty] = useState(false);
  const onSchoolDetailsDirty = useCallback((dirty: boolean) => setSchoolDetailsDirty(dirty), []);
  const [name, setName] = useState("");
  const [invitations, setInvitations] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("TEACHER");
  const [link, setLink] = useState("");
  const [shareMessage, setShareMessage] = useState<(InvitationMessage & { recipient: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const base = `/api/v1/admin/schools/${schoolId}`;

  useEffect(() => {
    const controller = new AbortController();
    api<{ schools: School[] }>("/api/v1/admin/schools", "GET", undefined, controller.signal)
      .then(data => { setSchools(data.schools); const selected=data.schools.find(s=>s.id===initialSchool)??data.schools[0];setSchoolId(selected?.id??"");setName(selected?.displayName??""); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [initialSchool]);

  useEffect(() => {
    if (!schoolId) return;
    const controller = new AbortController();
    setInvitations([]); setLink(""); setShareMessage(null);
    api<{ invitations: Invite[] }>(`/api/v1/admin/schools/${schoolId}/invitations`, "GET", undefined, controller.signal)
      .then(data => setInvitations(data.invitations)).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [schoolId]);

  async function refreshInvites() { setInvitations((await api<{ invitations: Invite[] }>(`${base}/invitations`)).invitations); }
  function showInvitation(data: { token: string; expiresAt: string }, roleCode: string, recipient: string) {
    const prepared = prepareInvitationMessage({ origin: window.location.origin, token: data.token,
      schoolName: schools?.find(s => s.id === schoolId)?.displayName ?? "Your school", roleCode, expiresAt: data.expiresAt });
    setLink(prepared.link); setShareMessage({ ...prepared, recipient });
  }
  async function action(run: () => Promise<void>) {
    setBusy(true); setError(""); setMessage("");
    try { await run(); } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); }
    finally { setBusy(false); }
  }

  function openSection(id:string) {
    const target=document.getElementById(id);
    if(target instanceof HTMLDetailsElement) target.open=true;
  }

  return <main className={styles.page}>
    <header className={styles.topbar}><div><a className={styles.brand} href="/dashboard">SpaceCase</a><WorkspaceSwitcher current="ADMIN" schoolId={schoolId} principal={schools?.find(s=>s.id===schoolId)?.principal===true}/></div>
      <div className={styles.actions}><form action="/auth/google?choose_account=1" method="post"><button className={styles.secondary}>Use another Google account</button></form><form action="/auth/logout" method="post"><button className={styles.secondary}>Sign out</button></form></div></header>
    <div className={styles.content}>
      <section className={styles.hero}><p className={styles.eyebrow}>Your school, ready to grow</p>
      <h1>School workspace</h1><p className={styles.lead}>Welcome your community and keep your school organised, one step at a time.</p></section>
      {schoolId ? <nav className={`${styles.quickNav} ${styles.compactNav}`} aria-label="School workspace sections"><a href={`/admin/families/${schoolId}`}><WorkspaceIcon name="family"/><span>Parents & learners</span></a><a href="#classes-section" onClick={()=>openSection("classes-section")}><WorkspaceIcon name="class"/><span>Classes & teachers</span></a><a href="#staff-section" onClick={()=>openSection("staff-section")}><WorkspaceIcon name="people"/><span>Invite staff</span></a><a href="#setup-section" onClick={()=>openSection("setup-section")}><WorkspaceIcon name="settings"/><span>School setup</span></a><a href="#billing-section" onClick={()=>openSection("billing-section")}><WorkspaceIcon name="billing"/><span>Billing records</span></a><a href="/support"><WorkspaceIcon name="support"/><span>Support</span></a></nav> : null}
      <AdministratorHelp/>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {message ? <p className={styles.notice} role="status">{message}</p> : null}
      {schools === null ? <p>Loading your workspace…</p> : schools.length === 0 ? <section className={styles.card}><h2>Administrator access required</h2><p>Your account is signed in, but it has no school administrator assignment.</p><a href="/dashboard">Back to workspace</a></section> : <>
        {schools.length > 1 ? <label className={styles.field}>School<select disabled={busy} value={schoolId} onChange={e => { if (schoolDetailsDirty && !window.confirm("Discard unsaved school details and switch schools?")) return; setSchoolDetailsDirty(false); setRole("TEACHER"); setSchoolId(e.target.value); setName(schools.find(s => s.id === e.target.value)?.displayName ?? ""); }}>{schools.map(s => <option key={s.id} value={s.id}>{s.displayName}</option>)}</select></label> : null}
        <section className={`${styles.card} ${styles.featureCard}`}><WorkspaceIcon name="family"/><h2>Onboard learners & invite parents</h2><p>Choose the learner, create a private invitation and share it by email or WhatsApp. Track acceptance and school confirmation in one place.</p><a className={styles.primary} href={`/admin/families/${schoolId}`}>Invite a parent / view invitation progress</a></section>
        {link ? <section className={styles.card}><h2>Your new invitation link</h2><p>Email not sent. Copy this link now; it cannot be retrieved later. You can create a replacement below if needed.</p>{shareMessage ? <InvitationShare recipient={shareMessage.recipient} message={shareMessage}/> : null}</section> : null}
        <div className={styles.sectionList} aria-label="School management tools">
          <details className={styles.disclosure} id="classes-section"><summary><WorkspaceIcon name="class"/><span><strong>Classes & teachers</strong><small>Create classes, assign teachers and manage learners</small></span><span className={styles.chevron} aria-hidden="true">⌄</span></summary><div className={styles.sectionBody}><ClassManager key={schoolId} schoolId={schoolId}/></div></details>
          <details className={styles.disclosure} id="staff-section"><summary><WorkspaceIcon name="people"/><span><strong>Staff invitations</strong><small>Invite one person or a group, and review invitations</small></span><span className={styles.chevron} aria-hidden="true">⌄</span></summary><div className={styles.sectionBody}>
            <p className={styles.deliveryNotice}>Invitations are shared manually for now. Creating a link does not send an email; use a prepared email, copy the message or share the link.</p>
            <section className={styles.card} id="staff-invitations"><WorkspaceIcon name="people"/><p className={styles.eyebrow}>Invite your team</p><h2>Bring someone aboard</h2><AdministratorGuide topic="invitations"/>
            <form onSubmit={e => { e.preventDefault(); void action(async () => {
              setLink(""); setShareMessage(null);
              const data = await api<{ token: string; expiresAt: string }>(`${base}/invitations`, "POST", { email, roleCode: role });
              showInvitation(data, role, email); setEmail(""); await refreshInvites(); setMessage("Invitation created. Open an email draft or copy the link below to share it.");
            }); }}>
              <label className={styles.field}>Their email address<input type="email" required maxLength={254} autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" /></label>
              <label className={styles.field}>Access<select value={role} onChange={e => setRole(e.target.value)}><option value="TEACHER">Teacher</option><option value="SCHOOL_ADMINISTRATOR" disabled={!schools.find(s=>s.id===schoolId)?.principal}>School administrator (principal only)</option></select></label>
              <p className={styles.note}>Teachers can be invited by school administrators. Only a currently assigned principal can appoint another administrator.</p><button className={styles.primary} disabled={busy}>Create invitation link</button>
            </form><p className={styles.note}>Links expire in seven days and require the invited email address. Teacher class access is assigned separately.</p>
          </section>
            <BulkInvitations key={`bulk-${schoolId}`} schoolId={schoolId} schoolName={schools.find(s=>s.id===schoolId)?.displayName??"Your school"} canInviteAdministrators={schools.find(s=>s.id===schoolId)?.principal===true} disabled={busy} onBusyChange={setBusy} onComplete={refreshInvites}/>
            <section className={styles.card}><h2>Invitations</h2>{invitations.length === 0 ? <p>No invitations yet. Add your first pilot participant above.</p> : <div className={styles.tableWrap}><table><thead><tr><th>Email</th><th>Access</th><th>Status</th><th>Email delivery</th><th>Expires</th><th><span className={styles.srOnly}>Action</span></th></tr></thead><tbody>{invitations.map(i => <tr key={i.id}><td>{i.email}</td><td>{roleName(i.roleCode)}</td><td>{inviteStatus(i)}</td><td>Not sent</td><td>{new Date(i.expiresAt).toLocaleDateString()}</td><td>{inviteStatus(i) === "Pending" ? <div className={styles.actions}><button className={styles.secondary} disabled={busy} onClick={() => { if (!window.confirm("Create a replacement invitation link? The previous link will stop working. The expiry date stays the same.")) return; void action(async () => { setLink(""); setShareMessage(null); const data = await api<{ token: string; expiresAt: string }>(`${base}/invitations/${i.id}`, "POST"); showInvitation(data, i.roleCode, i.email); await refreshInvites(); setMessage("Replacement link created. The previous link no longer works. Email not sent."); }); }}>Replace link</button><button className={styles.secondary} disabled={busy} onClick={() => { void action(async () => { await api(`${base}/invitations/${i.id}`, "DELETE"); await refreshInvites(); setLink(""); setShareMessage(null); setMessage("Invitation revoked."); }); }}>Revoke</button></div> : null}</td></tr>)}</tbody></table></div>}</section>
          </div></details>
          <details className={styles.disclosure} id="setup-section"><summary><WorkspaceIcon name="settings"/><span><strong>School setup</strong><small>School details, academic year and learner references</small></span><span className={styles.chevron} aria-hidden="true">⌄</span></summary><div className={styles.sectionBody}><section className={styles.card}><WorkspaceIcon name="settings"/><p className={styles.eyebrow}>School setup</p><h2>Make it yours</h2>
            <form onSubmit={e => { e.preventDefault(); void action(async () => {
              const data = await api<{ school: School }>(base, "PATCH", { displayName: name });
              setSchools(schools.map(s => s.id === schoolId ? data.school : s)); setName(data.school.displayName); setMessage("School name saved.");
            }); }}>
              <label className={styles.field}>School name<input required minLength={2} maxLength={120} value={name} onChange={e => setName(e.target.value)} /></label>
              <button className={styles.primary} disabled={busy}>Save school name</button>
            </form><p className={styles.note}>Your administrator access applies to this school.</p>
          </section><SchoolDetails key={`details-${schoolId}`} schoolId={schoolId} onDirty={onSchoolDetailsDirty}/><WorkspaceSetup key={`workspace-${schoolId}`} schoolId={schoolId}/></div></details>
          <details className={styles.disclosure} id="billing-section"><summary><WorkspaceIcon name="billing"/><span><strong>Billing records</strong><small>View recorded invoices, payments and service terms</small></span><span className={styles.chevron} aria-hidden="true">⌄</span></summary><div className={styles.sectionBody}><p><a href="/billing-policy">Read how school billing and service terms will work</a></p><BillingPanel key={`billing-${schoolId}`} schoolId={schoolId}/></div></details>
        </div>
      </>}
    </div>
  </main>;
}
