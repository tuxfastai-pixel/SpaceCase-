import {currentSession} from '@/platform/auth/currentSession';
import {readParentHome} from '@/platform/family/home';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const headers={'cache-control':'private, no-store'};
 if(new URL(request.url).search)return Response.json({error:'INVALID_INPUT'},{status:400,headers});
 try{if(!await currentSession())return Response.json({error:'UNAUTHENTICATED'},{status:401,headers});return Response.json(await readParentHome(request),{headers});}
 catch{return Response.json({error:'FAMILY_HOME_UNAVAILABLE'},{status:503,headers});}
}
