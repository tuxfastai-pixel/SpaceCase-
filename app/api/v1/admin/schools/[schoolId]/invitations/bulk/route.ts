import {peosProxy} from "@/platform/admin/peosProxy";
export const maxDuration=60;
export async function POST(request:Request,context:{params:Promise<{schoolId:string}>}){
  return peosProxy(request,`/v1/admin/schools/${encodeURIComponent((await context.params).schoolId)}/invitations/bulk`,await request.json().catch(()=>null),{},50_000);
}
