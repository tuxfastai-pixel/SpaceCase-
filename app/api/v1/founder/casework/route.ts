import {caseworkHandler} from "@/platform/casework/http";
export const maxDuration=30;
export async function GET(request:Request){return caseworkHandler(true)(request);}
export async function POST(request:Request){return caseworkHandler(true)(request);}
