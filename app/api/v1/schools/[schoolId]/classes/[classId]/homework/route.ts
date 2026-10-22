import {homeworkRequest} from "@/platform/homework/http";
export const dynamic="force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{schoolId:string;classId:string}>}){return homeworkRequest(request,await params);}
export const POST=GET;
