import {workspaceRequest} from "@/platform/admin/workspaceHttp";
export const maxDuration=60;
export async function GET(request:Request,context:{params:Promise<{schoolId:string}>}){return workspaceRequest(request,(await context.params).schoolId);}
export async function POST(request:Request,context:{params:Promise<{schoolId:string}>}){return workspaceRequest(request,(await context.params).schoolId);}
