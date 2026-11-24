import {z} from 'zod';import {boundedText} from '../http/boundedText';import {sameOrigin} from '../admin/peosProxy';import {FamilyBillingError} from '../family/billingAuthority';
import {parentInboxEnabled,conversationPool,conversationDirectory,requireConversation} from './authority';import {conversationCommand} from '../../domains/school-communications/contracts';import {ConversationError,conversation,readParentInbox,readStaffConversations} from '../../domains/school-communications/service';
const uuid=z.string().uuid().toLowerCase(),headers={'cache-control':'private, no-store'};
const target={offerId:uuid.optional(),threadId:uuid.optional(),before:z.string().regex(/^[1-9][0-9]{0,18}$/).optional()};
const parentQuery=z.object({grantId:uuid,...target}).strict(),staffQuery=z.object({schoolId:uuid,threadId:uuid.optional(),before:target.before}).strict();
export function conversationHttp(kind:'PARENT'|'STAFF',deps={pool:conversationPool,authorize:requireConversation,directory:conversationDirectory,conversation,parents:readParentInbox,staff:readStaffConversations}){return async(request:Request)=>{
 if(!parentInboxEnabled())return Response.json({error:'PARENT_INBOX_NOT_ENABLED'},{status:503,headers});
 try{
  if(!['GET','POST'].includes(request.method))return Response.json({error:'METHOD_NOT_ALLOWED'},{status:405,headers});
  const q=new URL(request.url).searchParams;for(const key of q.keys())if(q.getAll(key).length!==1)throw new SyntaxError();
  if(request.method==='POST'&&!sameOrigin(request))return Response.json({error:'FORBIDDEN'},{status:403,headers});
  if(kind==='PARENT'&&request.method==='GET'&&(!q.size||q.has('noticeId')||q.has('lookupThreadId'))){const lookup=z.object({noticeId:uuid.optional(),lookupThreadId:uuid.optional()}).strict().parse(Object.fromEntries(q));return Response.json(await deps.parents(deps.pool(),()=>deps.directory(request),{noticeId:lookup.noticeId,threadId:lookup.lookupThreadId}),{headers});}
  const input=kind==='PARENT'?parentQuery.parse(Object.fromEntries(q)):staffQuery.parse(Object.fromEntries(q));
  const authorize=()=>deps.authorize(request,kind,'grantId'in input?input.grantId:input.schoolId);
  if(kind==='STAFF'&&request.method==='GET'&&!input.threadId)return Response.json(await deps.staff(deps.pool(),authorize),{headers});
  if(request.method==='POST'&&input.before)throw new SyntaxError();const command=request.method==='POST'?conversationCommand.parse(JSON.parse(await boundedText(request,8192))):undefined;
  return Response.json(await deps.conversation(deps.pool(),{offerId:'offerId'in input?input.offerId:undefined,threadId:input.threadId,before:input.before},authorize,command),{headers});
 }catch(e){if(e instanceof FamilyBillingError)return Response.json({error:e.code},{status:e.status,headers});if(e instanceof ConversationError)return Response.json({error:e.code},{status:e.status,headers});if(e instanceof z.ZodError||e instanceof SyntaxError)return Response.json({error:'INVALID_INPUT'},{status:400,headers});if(e instanceof RangeError)return Response.json({error:'REQUEST_TOO_LARGE'},{status:413,headers});return Response.json({error:'CONVERSATIONS_UNAVAILABLE'},{status:503,headers});}
};}
