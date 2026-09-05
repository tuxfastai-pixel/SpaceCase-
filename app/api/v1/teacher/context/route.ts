import { handleTeacherContextRequest } from "../../../../../domains/teacher-context/http";
import { UnavailablePeosGateway } from "../../../../../platform/peos/unavailableGateway";
import { UnavailableSessionResolver } from "../../../../../platform/session/contracts";

const sessionResolver = new UnavailableSessionResolver();
const peos = new UnavailablePeosGateway();

export async function GET(request: Request): Promise<Response> {
  return handleTeacherContextRequest(request, sessionResolver, peos);
}
