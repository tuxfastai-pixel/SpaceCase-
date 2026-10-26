import { redirect } from "next/navigation";
import { currentSession } from "../../platform/auth/currentSession";
import styles from "./login.module.css";

const messages: Record<string, string> = {
  signin: "Sign-in wasn’t completed. Please try again.",
  account: "Your account couldn’t be opened. Please contact your school administrator.",
  unavailable: "We couldn’t open your workspace just now. Please try again shortly.",
};

export const metadata={title:'Sign in | SpaceCase'};
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  let signedIn = false;
  try { signedIn = Boolean(await currentSession()); } catch { /* Show sign-in without granting access. */ }
  if (signedIn) redirect("/dashboard");
  const { error } = await searchParams;
  return <main className={styles.page}>
    <section className={styles.card} aria-labelledby="welcome">
      <span className={styles.mark} aria-hidden="true">S</span>
      <p className={styles.brand}>SPACECASE</p>
      <h1 id="welcome">More time for what matters.</h1>
      <p>A calmer space for teaching, learning and supporting your school community.</p>
      <form action="/auth/google" method="post">
        <button className={styles.button} type="submit">Continue with Google</button>
      </form>
      <form action="/auth/google?choose_account=1" method="post">
        <button className={styles.switchAccount} type="submit">Use another Google account</button>
      </form>
      <p className={styles.note}>Choose the Google account you want to use. Signing out of SpaceCase does not sign you out of Google on this device.</p>
      <p className={styles.note}>New here? Your account is created when you continue. No separate password needed.</p>
      <p className={styles.note}><a href="/help/parents">Need a hand? Parent / guardian help and current availability</a></p>
      {error ? <p role="alert">{Object.hasOwn(messages, error) ? messages[error] : messages.signin}</p> : null}
    </section>
  </main>;
}
