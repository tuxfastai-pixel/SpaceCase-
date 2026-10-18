"use client";
import { useEffect, useRef, useState } from "react";
import styles from "../login/login.module.css";

type State = { status: "loading" | "signin" | "error" | "accepting" } | { status: "ready"; schoolName: string; roleCode: string };
export default function JoinClient() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [message, setMessage] = useState("");
  const initialToken = useRef<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const token = initialToken.current ?? new URLSearchParams(window.location.hash.slice(1)).get("token");
      initialToken.current = token;
      if (token) {
        window.history.replaceState(null, "", "/join");
        const stored = await fetch("/api/v1/invitations/pending", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }), signal: controller.signal });
        if (!stored.ok) { setMessage("This invitation link is invalid."); setState({ status: "error" }); return; }
      }
      const response = await fetch("/api/v1/invitations/preview", { method: "POST", cache: "no-store", signal: controller.signal });
      if (response.status === 401) { setState({ status: "signin" }); return; }
      if (!response.ok) { setMessage("This invitation is no longer available. Ask the school administrator for a new link."); setState({ status: "error" }); return; }
      const invitation = await response.json() as { schoolName: string; roleCode: string };
      setState({ status: "ready", ...invitation });
    }
    void load().catch(() => { if (!controller.signal.aborted) { setMessage("We couldn’t open this invitation. Please refresh and try again."); setState({ status: "error" }); } });
    return () => controller.abort();
  }, []);

  async function accept() {
    setState({ status: "accepting" });
    try {
      const response = await fetch("/api/v1/invitations/accept", { method: "POST", cache: "no-store" });
      if (response.ok) { window.location.assign("/dashboard"); return; }
      const body = await response.json();
      if (response.status === 401 || body.error === "INVITED_EMAIL_REQUIRED") {
        setMessage("Please sign in with the email address this invitation was sent to."); setState({ status: "signin" }); return;
      }
      setMessage("This invitation couldn’t be accepted. It may have expired or been revoked. Ask your school administrator for help."); setState({ status: "error" });
    } catch { setMessage("We couldn’t connect. Refresh this page to try again."); setState({ status: "error" }); }
  }

  return <main className={styles.page}><section className={styles.card}>
    <span className={styles.mark} aria-hidden="true">S</span><p className={styles.brand}>SPACECASE</p>
    <h1>{state.status === "ready" ? `Join ${state.schoolName}` : "You’re invited"}</h1>
    {message ? <p role="alert">{message}</p> : null}
    {state.status === "loading" ? <p role="status">Opening your invitation…</p> : null}
    {state.status === "signin" ? <><p>Continue with the Google account matching your invitation. Your account will be created if you’re new.</p><form action="/auth/google?choose_account=1" method="post"><button className={styles.button}>Continue with Google</button></form></> : null}
    {state.status === "ready" ? <><p>You’ve been invited as a {state.roleCode === "SCHOOL_ADMINISTRATOR" ? "school administrator" : "teacher"}.</p><button className={styles.button} onClick={() => void accept()}>Accept invitation</button></> : null}
    {state.status === "accepting" ? <p role="status">Connecting your account…</p> : null}
    <p className={styles.note}><a href="/dashboard">Back to workspace</a></p>
  </section></main>;
}
