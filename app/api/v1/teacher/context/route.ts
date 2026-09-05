import { handleTeacherContextRequest } from "../../../../../domains/teacher-context/http";
import { readServerEnvironment } from "../../../../../platform/config/env";
import { HttpPeosGateway } from "../../../../../platform/peos/httpGateway";
import { PeosSessionResolver } from "../../../../../platform/session/peosSessionResolver";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const environment = readServerEnvironment();
  if (!environment.PEOS_BASE_URL) {
    return Response.json({ error: "PEOS_UNAVAILABLE" }, { status: 503 });
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const sessionResolver = new PeosSessionResolver(environment.PEOS_BASE_URL);
  const peos = new HttpPeosGateway(environment.PEOS_BASE_URL, authorization);

  try {
    return await handleTeacherContextRequest(request, sessionResolver, peos);
  } catch {
    return Response.json({ error: "PEOS_UNAVAILABLE" }, { status: 503 });
  }
}
