import { peosProxy } from "@/platform/admin/peosProxy";
export async function DELETE(request:Request,context:{params:Promise<{schoolId:string;classId:string;teacherPersonId:string}>}){
  const p=await context.params;
  return peosProxy(request,`/v1/admin/schools/${encodeURIComponent(p.schoolId)}/classes/${encodeURIComponent(p.classId)}/teachers/${encodeURIComponent(p.teacherPersonId)}`);
}
