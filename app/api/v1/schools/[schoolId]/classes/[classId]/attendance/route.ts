import {attendanceRequest} from "@/platform/attendance/http";
type Context={params:Promise<{schoolId:string;classId:string}>};
export async function GET(request:Request,context:Context){return attendanceRequest(request,await context.params);}
export async function PUT(request:Request,context:Context){return attendanceRequest(request,await context.params);}
