import {createSchoolClass} from "@/platform/admin/classHttp";
import { peosProxy } from "@/platform/admin/peosProxy";
type Context={params:Promise<{schoolId:string}>};
export async function GET(request:Request,context:Context){
  return peosProxy(request,`/v1/admin/schools/${encodeURIComponent((await context.params).schoolId)}/classes`);
}
export async function POST(request:Request,context:Context){
  return createSchoolClass(request,(await context.params).schoolId);
}
