import {getDatabasePool} from '../db/pool';import {readServerEnvironment} from '../config/env';import {resolvePeosAuthorization} from '../session/peosAuthorization';import {peosPreviewHeaders} from '../peos/previewHeaders';import {familyFinanceEnabled,FamilyBillingError} from '../family/billingAuthority';import {conversationAuthority,parentConversationDirectory} from '../../domains/school-communications/contracts';
export const parentInboxEnabled=()=>familyFinanceEnabled()&&process.env.SPACECASE_PARENT_INBOX_ENABLED==='true';
async function call(request:Request,path:string,post=false,fetchImpl:typeof fetch=fetch){
 const token=resolvePeosAuthorization(request),env=readServerEnvironment();if(!token)throw new FamilyBillingError(401,'UNAUTHENTICATED');if(!env.PEOS_BASE_URL)throw new FamilyBillingError(503,'CONVERSATIONS_UNAVAILABLE');
 let r:Response;try{r=await fetchImpl(new URL(path,env.PEOS_BASE_URL),{method:post?'POST':'GET',headers:{authorization:token,'content-type':'application/json',...peosPreviewHeaders(process.env.VERCEL_ENV==='preview'?request.headers.get('x-vercel-oidc-token'):null)},body:post?JSON.stringify({purpose:'FINANCE_CONVERSATION'}):undefined,cache:'no-store',signal:AbortSignal.timeout(10000)});}catch{throw new FamilyBillingError(503,'CONVERSATIONS_UNAVAILABLE');}
 if(!r.ok)throw new FamilyBillingError(r.status===401?401:r.status===403?403:503,'CONVERSATION_FORBIDDEN');return r.json();
}
export async function requireConversation(request:Request,kind:'PARENT'|'STAFF',id:string,fetchImpl:typeof fetch=fetch){
 const parsed=conversationAuthority.safeParse(await call(request,kind==='PARENT'?`/v1/family/conversations/${encodeURIComponent(id)}/authorize`:`/v1/finance/schools/${encodeURIComponent(id)}/conversations/authorize`,true,fetchImpl));
 if(!parsed.success||parsed.data.role!==kind||(parsed.data.role==='PARENT'?parsed.data.grantId!==id:parsed.data.schoolId!==id)||Date.parse(parsed.data.expiresAt)<=Date.now()||Date.parse(parsed.data.expiresAt)>Date.now()+60000)throw new FamilyBillingError(403,'CONVERSATION_FORBIDDEN');return parsed.data;
}
export async function conversationDirectory(request:Request,fetchImpl:typeof fetch=fetch){return parentConversationDirectory.parse(await call(request,'/v1/family/conversations',false,fetchImpl));}
export const conversationPool=getDatabasePool;
