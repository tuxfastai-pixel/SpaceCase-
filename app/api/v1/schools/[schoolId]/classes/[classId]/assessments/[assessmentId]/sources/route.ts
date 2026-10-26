import {sourceRequest} from '@/platform/assessment/sourceHttp';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{schoolId:string;classId:string;assessmentId:string}>}){return sourceRequest(request,await params);}
