/** Existing deployments retain sign-in unless explicitly paused by their owner. */
export function googleSignInEnabled(source: Record<string, string | undefined> = process.env) {
  return source.SPACECASE_GOOGLE_SIGNIN_ENABLED !== "false";
}
