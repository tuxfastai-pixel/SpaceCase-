import {storageReady} from "@/domains/workspace/service";
import {getDatabasePool} from "@/platform/db/pool";
export const dynamic="force-dynamic";
export async function GET(){try{await storageReady(getDatabasePool());return Response.json({service:"spacecase",status:"ready"},{headers:{"cache-control":"no-store"}});}catch{return Response.json({service:"spacecase",status:"not_ready"},{status:503,headers:{"cache-control":"no-store"}});}}
