import {peosProxy} from "@/platform/admin/peosProxy";
export const maxDuration=60;
type Context={params:Promise<{schoolId:string;classId:string}>};
function path(p:{schoolId:string;classId:string}){return `/v1/admin/schools/${encodeURIComponent(p.schoolId)}/classes/${encodeURIComponent(p.classId)}/learners`;}
export async function GET(request:Request,context:Context){return peosProxy(request,path(await context.params)+new URL(request.url).search);}
export async function POST(request:Request,context:Context){return peosProxy(request,path(await context.params),await request.json().catch(()=>null),{},50_000);}
