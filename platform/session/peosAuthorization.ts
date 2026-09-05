export const PEOS_SESSION_COOKIE = "peos_session";

export function resolvePeosAuthorization(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return header;

  const cookie = request.headers.get("cookie");
  if (!cookie) return null;

  for (const part of cookie.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    if (name === PEOS_SESSION_COOKIE) {
      const value = decodeURIComponent(valueParts.join("="));
      return value ? `Bearer ${value}` : null;
    }
  }

  return null;
}
