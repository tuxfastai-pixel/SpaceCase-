type CodeExchange = (code: string) => Promise<{
  data: { session: { access_token: string } | null };
  error: unknown;
}>;

export async function completeSignIn(
  code: string,
  exchangeCode: CodeExchange,
  exchangePeos: (accessToken: string) => Promise<Response>,
): Promise<{ cookie: string } | { error: "signin" | "account" | "unavailable" }> {
  try {
    const result = await exchangeCode(code);
    if (result.error || !result.data.session) return { error: "signin" };
    const response = await exchangePeos(result.data.session.access_token);
    if (response.status !== 201) return { error: response.status === 403 ? "account" : "unavailable" };
    const cookie = response.headers.get("set-cookie");
    return cookie ? { cookie } : { error: "unavailable" };
  } catch {
    return { error: "signin" };
  }
}
