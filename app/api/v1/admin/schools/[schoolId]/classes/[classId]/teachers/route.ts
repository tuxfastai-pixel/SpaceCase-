import { peosProxy } from "@/platform/admin/peosProxy";
export async function POST(request:Request,context:{params:Promise<{schoolId:string;classId:string}>}){
  const p=await context.params;
  return peosProxy(request,`/v1/admin/schools/${encodeURIComponent(p.schoolId)}/classes/${encodeURIComponent(p.classId)}/teachers`,await request.json().catch(()=>null));
}
