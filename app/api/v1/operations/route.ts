import {operationsHandler} from "@/platform/operations/http";
export async function GET(request:Request){return operationsHandler()(request);}
