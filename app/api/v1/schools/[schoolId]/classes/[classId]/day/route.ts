import {teacherDayRequest} from "@/platform/teacher-day/http";
export const dynamic="force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{schoolId:string;classId:string}>}){return teacherDayRequest(request,await params);}
