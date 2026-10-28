import {financeHandler} from '@/platform/school-finance/http';const handler=financeHandler();type Context={params:Promise<{schoolId:string}>};
export async function GET(request:Request,{params}:Context){return handler(request,(await params).schoolId);}
export async function POST(request:Request,{params}:Context){return handler(request,(await params).schoolId);}
