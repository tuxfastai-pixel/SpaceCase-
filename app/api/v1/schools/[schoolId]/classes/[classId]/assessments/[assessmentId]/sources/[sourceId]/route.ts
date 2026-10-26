import {sourceRequest} from '@/platform/assessment/sourceHttp';
export const dynamic='force-dynamic';
export const maxDuration=120;
export async function GET(request:Request,{params}:{params:Promise<{schoolId:string;classId:string;assessmentId:string;sourceId:string}>}){return sourceRequest(request,await params);}
export const PUT=GET;
export const POST=GET;
