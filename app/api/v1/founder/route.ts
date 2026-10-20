import {founderHandler} from "@/platform/support/http";
const handler=founderHandler();
export async function GET(request:Request){return handler(request);}
export async function POST(request:Request){return handler(request);}
