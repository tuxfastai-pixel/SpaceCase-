import {assessmentRequest,type Params} from "@/platform/assessment/http";
export const dynamic="force-dynamic";
export const maxDuration=120;
export async function GET(request:Request,{params}:{params:Promise<Params>}){return assessmentRequest(request,await params);}
export const POST=GET;
export const PUT=GET;
