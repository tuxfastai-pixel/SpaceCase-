import {reportsRequest} from '@/platform/reports/http';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{schoolId:string;classId:string}>}){return reportsRequest(request,await params);}
