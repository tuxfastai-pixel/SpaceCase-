import {supportHandler} from "@/platform/support/http";
const handler=supportHandler();
type Context={params:Promise<{ticketId:string}>};
export async function GET(request:Request,context:Context){return handler(request,(await context.params).ticketId);}
export async function POST(request:Request,context:Context){return handler(request,(await context.params).ticketId);}
