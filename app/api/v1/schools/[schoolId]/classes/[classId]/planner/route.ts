import {plannerRequest} from "@/platform/planner/http";
export const dynamic="force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{schoolId:string;classId:string}>}){return plannerRequest(request,await params);}
export const PUT=GET;
