import {billingHandler} from "@/platform/billing/http";
export const maxDuration=30;
export async function GET(request:Request){return billingHandler()(request);}
export async function POST(request:Request){return billingHandler()(request);}
