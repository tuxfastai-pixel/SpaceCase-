import { peosProxy } from "@/platform/admin/peosProxy";
export async function GET(request: Request) { return peosProxy(request, "/v1/admin/schools"); }
