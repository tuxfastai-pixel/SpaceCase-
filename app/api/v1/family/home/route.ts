import {currentSession} from '@/platform/auth/currentSession';
import {readParentHome} from '@/platform/family/home';
import {sameOrigin} from '@/platform/admin/peosProxy';
import {getDatabasePool} from '@/platform/db/pool';
import {boundedText} from '@/platform/http/boundedText';
import {homeNoticeSeen,acknowledgeHomeNotice,HomeNoticeChanged} from '@/platform/family/homeNotice';
import {ZodError} from 'zod';
export const dynamic='force-dynamic';
const headers={'cache-control':'private, no-store'};
export async function GET(request:Request){
 if(new URL(request.url).search)return Response.json({error:'INVALID_INPUT'},{status:400,headers});
 try{const session=await currentSession();if(!session)return Response.json({error:'UNAUTHENTICATED'},{status:401,headers});const home=await readParentHome(request);const readyAcknowledged=home.readyNoticeKey?await homeNoticeSeen(getDatabasePool(),session.personId,home.readyNoticeKey):false;return Response.json({...home,readyAcknowledged},{headers});}
 catch{return Response.json({error:'FAMILY_HOME_UNAVAILABLE'},{status:503,headers});}
}
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({error:'FORBIDDEN'},{status:403,headers});
 if(new URL(request.url).search)return Response.json({error:'INVALID_INPUT'},{status:400,headers});
 try{const session=await currentSession();if(!session)return Response.json({error:'UNAUTHENTICATED'},{status:401,headers});const value=JSON.parse(await boundedText(request,256));return Response.json(await acknowledgeHomeNotice(getDatabasePool(),session.personId,value,()=>readParentHome(request)),{headers});}
 catch(e){if(e instanceof HomeNoticeChanged)return Response.json({error:'HOME_NOTICE_CHANGED'},{status:409,headers});if(e instanceof ZodError||e instanceof SyntaxError||e instanceof RangeError)return Response.json({error:'INVALID_INPUT'},{status:400,headers});return Response.json({error:'HOME_ACKNOWLEDGEMENT_UNAVAILABLE'},{status:503,headers});}
}
