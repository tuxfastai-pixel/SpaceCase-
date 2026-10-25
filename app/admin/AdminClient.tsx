"use client";
import { useEffect, useState } from "react";
import AdministratorHelp, {AdministratorGuide} from "../help/AdministratorHelp";
import styles from "./admin.module.css";
import { invitationEmailDraft, prepareInvitationMessage, type InvitationMessage } from "../../platform/invitations/message";
import ClassManager from "./ClassManager";
import BulkInvitations from "./BulkInvitations";
import BillingPanel from "../billing/BillingPanel";
import WorkspaceSetup from "./WorkspaceSetup";

type School = { id: string; displayName: string };
type Invite = { id: string; email: string; roleCode: string; expiresAt: string; acceptedAt: string | null; revokedAt: string | null };
const errors: Record<string, string> = {
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

export default function AdminClient() {
  const [schools, setSchools] = useState<School[] | null>(null);
  const [schoolId, setSchoolId] = useState("");
  const [name, setName] = useState("");
  const [invitations, setInvitations] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("TEACHER");
  const [link, setLink] = useState("");
  const [shareMessage, setShareMessage] = useState<(InvitationMessage & { draftUrl: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const base = `/api/v1/admin/schools/${schoolId}`;

  useEffect(() => {
    const controller = new AbortController();
    api<{ schools: School[] }>("/api/v1/admin/schools", "GET", undefined, controller.signal)
      .then(data => { setSchools(data.schools); setSchoolId(data.schools[0]?.id ?? ""); setName(data.schools[0]?.displayName ?? ""); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, []);

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
    setLink(prepared.link); setShareMessage({ ...prepared, draftUrl: invitationEmailDraft(recipient, prepared) });
  }
  async function action(run: () => Promise<void>) {
    setBusy(true); setError(""); setMessage("");
    try { await run(); } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); }
    finally { setBusy(false); }
  }

  return <main className={styles.page}>
    <header className={styles.topbar}><a className={styles.brand} href="/dashboard">SpaceCase <span>School administration</span></a>
      <form action="/auth/logout" method="post"><button className={styles.secondary}>Sign out</button></form></header>
    <div className={styles.content}>
      <p className={styles.eyebrow}>Your school, ready to grow</p>
      <h1>School workspace</h1><p className={styles.lead}>Set up your school and welcome your pilot team.</p>
      <AdministratorHelp/>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {message ? <p className={styles.notice} role="status">{message}</p> : null}
      <section className={styles.card} aria-label="Invitation delivery"><p className={styles.eyebrow}>Pilot invitation delivery</p><h2>Share invitations manually</h2><p>Automatic email delivery is disabled. Creating an invitation does not send an email. Open a prefilled email draft or copy the link or message to share it with the invited person.</p><p className={styles.note}>Email delivery will become available after setup is complete.</p></section>
      {schools === null ? <p>Loading your workspace…</p> : schools.length === 0 ? <section className={styles.card}><h2>Administrator access required</h2><p>Your account is signed in, but it has no school administrator assignment.</p><a href="/dashboard">Back to workspace</a></section> : <>
        {schools.length > 1 ? <label className={styles.field}>School<select disabled={busy} value={schoolId} onChange={e => { setSchoolId(e.target.value); setName(schools.find(s => s.id === e.target.value)?.displayName ?? ""); }}>{schools.map(s => <option key={s.id} value={s.id}>{s.displayName}</option>)}</select></label> : null}
        <div className={styles.grid}>
          <section className={styles.card}><p className={styles.eyebrow}>School setup</p><h2>Make it yours</h2>
            <form onSubmit={e => { e.preventDefault(); void action(async () => {
              const data = await api<{ school: School }>(base, "PATCH", { displayName: name });
              setSchools(schools.map(s => s.id === schoolId ? data.school : s)); setName(data.school.displayName); setMessage("School name saved.");
            }); }}>
              <label className={styles.field}>School name<input required minLength={2} maxLength={120} value={name} onChange={e => setName(e.target.value)} /></label>
              <button className={styles.primary} disabled={busy}>Save school name</button>
            </form><p className={styles.note}>Your administrator access applies to this school.</p>
          </section>
          <section className={styles.card}><p className={styles.eyebrow}>Invite your team</p><h2>Bring someone aboard</h2><AdministratorGuide topic="invitations"/>
            <form onSubmit={e => { e.preventDefault(); void action(async () => {
              setLink(""); setShareMessage(null);
              const data = await api<{ token: string; expiresAt: string }>(`${base}/invitations`, "POST", { email, roleCode: role });
              showInvitation(data, role, email); setEmail(""); await refreshInvites(); setMessage("Invitation created. Open an email draft or copy the link below to share it.");
            }); }}>
              <label className={styles.field}>Their email address<input type="email" required maxLength={254} autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" /></label>
              <label className={styles.field}>Access<select value={role} onChange={e => setRole(e.target.value)}><option value="TEACHER">Teacher</option><option value="SCHOOL_ADMINISTRATOR">School administrator</option></select></label>
              <button className={styles.primary} disabled={busy}>Create invitation link</button>
            </form><p className={styles.note}>Links expire in seven days and require the invited email address. Teacher class access is assigned separately.</p>
          </section>
        </div>
        <p><a href="/billing-policy">Read how school billing and service terms will work</a></p>
        <BillingPanel key={`billing-${schoolId}`} schoolId={schoolId}/>
        <WorkspaceSetup key={`workspace-${schoolId}`} schoolId={schoolId}/>
        <ClassManager key={schoolId} schoolId={schoolId}/>
        <BulkInvitations key={`bulk-${schoolId}`} schoolId={schoolId} schoolName={schools.find(s=>s.id===schoolId)?.displayName??"Your school"} disabled={busy} onBusyChange={setBusy} onComplete={refreshInvites}/>
        {link ? <section className={styles.card}><h2>Your new invitation link</h2><p>Email not sent. Copy this link now; it cannot be retrieved later. You can create a replacement below if needed.</p><div className={styles.copyRow}><input aria-label="Invitation link" readOnly value={link} onFocus={e => e.target.select()} /><button className={styles.secondary} onClick={() => { void action(async () => { await navigator.clipboard.writeText(link); setMessage("Invitation link copied. Share it with the invited person."); }); }}>Copy link</button></div>{shareMessage ? <><div className={styles.draftActions}><a className={styles.primary} href={shareMessage.draftUrl} onClick={() => setMessage("Email draft requested—sending not confirmed. Review it in your email app and press Send. SpaceCase cannot confirm whether it opened or was sent.")}>Open email draft</a><p className={styles.note}>Opens your configured email app with the recipient and message filled in. Review the draft and press Send yourself. If nothing opens, use Copy invitation message below. SpaceCase cannot confirm sending or delivery.</p></div><label className={styles.field}>Ready-to-share invitation<textarea readOnly rows={8} value={shareMessage.text} /></label><button className={styles.secondary} onClick={() => { void action(async () => { await navigator.clipboard.writeText(shareMessage.text); setMessage("Invitation message copied. Email not sent."); }); }}>Copy invitation message</button></> : null}</section> : null}
        <section className={styles.card}><h2>Invitations</h2>{invitations.length === 0 ? <p>No invitations yet. Add your first pilot participant above.</p> : <div className={styles.tableWrap}><table><thead><tr><th>Email</th><th>Access</th><th>Status</th><th>Email delivery</th><th>Expires</th><th><span className={styles.srOnly}>Action</span></th></tr></thead><tbody>{invitations.map(i => <tr key={i.id}><td>{i.email}</td><td>{roleName(i.roleCode)}</td><td>{inviteStatus(i)}</td><td>Not sent</td><td>{new Date(i.expiresAt).toLocaleDateString()}</td><td>{inviteStatus(i) === "Pending" ? <div className={styles.actions}><button className={styles.secondary} disabled={busy} onClick={() => { if (!window.confirm("Create a replacement invitation link? The previous link will stop working. The expiry date stays the same.")) return; void action(async () => { setLink(""); setShareMessage(null); const data = await api<{ token: string; expiresAt: string }>(`${base}/invitations/${i.id}`, "POST"); showInvitation(data, i.roleCode, i.email); await refreshInvites(); setMessage("Replacement link created. The previous link no longer works. Email not sent."); }); }}>Replace link</button><button className={styles.secondary} disabled={busy} onClick={() => { void action(async () => { await api(`${base}/invitations/${i.id}`, "DELETE"); await refreshInvites(); setLink(""); setShareMessage(null); setMessage("Invitation revoked."); }); }}>Revoke</button></div> : null}</td></tr>)}</tbody></table></div>}</section>
      </>}
    </div>
  </main>;
}
