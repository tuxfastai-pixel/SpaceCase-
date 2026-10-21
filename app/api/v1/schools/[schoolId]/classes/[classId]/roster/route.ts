import {peosProxy} from "@/platform/admin/peosProxy";
export async function GET(request:Request,context:{params:Promise<{schoolId:string;classId:string}>}){
 const p=await context.params;return peosProxy(request,`/v1/schools/${encodeURIComponent(p.schoolId)}/classes/${encodeURIComponent(p.classId)}/roster${new URL(request.url).search}`);
}
