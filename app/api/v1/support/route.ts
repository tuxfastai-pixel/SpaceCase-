import {supportHandler} from "@/platform/support/http";
const handler=supportHandler();
export async function GET(request:Request){return handler(request);}
export async function POST(request:Request){return handler(request);}
