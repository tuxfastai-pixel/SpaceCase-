import {observationsRequest} from "@/platform/observations/http";
export const dynamic="force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{schoolId:string;classId:string}>}){return observationsRequest(request,await params);}
export const POST=GET;
