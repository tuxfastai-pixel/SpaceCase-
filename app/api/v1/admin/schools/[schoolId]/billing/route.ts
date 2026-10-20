import {billingHandler} from "@/platform/billing/http";
export const maxDuration=30;
export async function GET(request:Request,context:{params:Promise<{schoolId:string}>}){return billingHandler()(request,(await context.params).schoolId);}
