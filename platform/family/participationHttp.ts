import {z} from 'zod';
import {getDatabasePool} from '../db/pool';
import {boundedText} from '../http/boundedText';
import {familyPlansEnabled} from './activityPlanHttp';
import {requireFamilyBilling,FamilyBillingError} from './billingAuthority';
import {requireFinanceLearner,requireSchoolFinancePermission} from '../finance/peosAuthorization';
import {financeFailure} from '../finance/workspaceHttp';
import {activityOfferInput,participationInput,offerActivity,readActivityOffers,decideParticipation,ParticipationError} from '../../domains/school-activities/participationService';
export const participationEnabled=()=>familyPlansEnabled()&&process.env.SPACECASE_OPTIONAL_ACTIVITY_PARTICIPATION_ENABLED==='true';
const uuid=z.string().uuid().toLowerCase(),headers={'cache-control':'private, no-store'};
const staff=z.object({schoolId:uuid,accountId:uuid,offer:activityOfferInput}).strict();
const parent=z.object({grantId:uuid,decision:participationInput}).strict();
function sameOrigin(request:Request){return !!process.env.SPACECASE_PUBLIC_URL&&request.headers.get('origin')===new URL(process.env.SPACECASE_PUBLIC_URL).origin;}
function params(request:Request){const q=new URL(request.url).searchParams;for(const k of q.keys())if(q.getAll(k).length!==1)throw new SyntaxError();return q;}
export function staffOfferHandler(deps={pool:getDatabasePool,permission:requireSchoolFinancePermission,learner:requireFinanceLearner,offer:offerActivity}){return async(request:Request)=>{
 if(!participationEnabled())return Response.json({error:'ACTIVITY_PARTICIPATION_NOT_ENABLED'},{status:503,headers});
 try{
  if(request.method!=='POST')return Response.json({error:'METHOD_NOT_ALLOWED'},{status:405,headers});
  if(!sameOrigin(request))return Response.json({error:'FORBIDDEN'},{status:403,headers});
  if(params(request).size)throw new SyntaxError();const input=staff.parse(JSON.parse(await boundedText(request,4096)));
  const d=await deps.permission(request,input.schoolId,'finance.transactions.record');
  return Response.json(await deps.offer(deps.pool(),{schoolId:input.schoolId,accountId:input.accountId,actorPersonId:d.personId},input.offer,(school,action)=>deps.permission(request,school,action),async reference=>(await deps.learner(request,input.schoolId,reference)).personId),{headers});
 }catch(e){if(e instanceof ParticipationError)return Response.json({error:e.message},{status:409,headers});return financeFailure(e);}
};}
export function parentParticipationHandler(deps={pool:getDatabasePool,authorize:requireFamilyBilling,read:readActivityOffers,decide:decideParticipation}){return async(request:Request)=>{
 if(!participationEnabled())return Response.json({error:'ACTIVITY_PARTICIPATION_NOT_ENABLED'},{status:503,headers});
 try{
  const q=params(request);
  if(request.method==='GET'){const input=z.object({grantId:uuid}).strict().parse(Object.fromEntries(q));return Response.json(await deps.read(deps.pool(),input.grantId,id=>deps.authorize(request,id,'family.finance.read')),{headers});}
  if(request.method!=='POST')return Response.json({error:'METHOD_NOT_ALLOWED'},{status:405,headers});
  if(!sameOrigin(request))return Response.json({error:'FORBIDDEN'},{status:403,headers});if(q.size)throw new SyntaxError();
  const input=parent.parse(JSON.parse(await boundedText(request,4096)));
  return Response.json(await deps.decide(deps.pool(),input.grantId,input.decision,id=>deps.authorize(request,id,'family.finance.activity.accept')),{headers});
 }catch(e){
  if(e instanceof FamilyBillingError)return Response.json({error:e.code},{status:e.status,headers});
  if(e instanceof ParticipationError)return Response.json({error:e.message},{status:409,headers});
  if(e instanceof z.ZodError||e instanceof SyntaxError)return Response.json({error:'INVALID_INPUT'},{status:400,headers});
  if(e instanceof RangeError)return Response.json({error:'REQUEST_TOO_LARGE'},{status:413,headers});
  return Response.json({error:'ACTIVITY_PARTICIPATION_UNAVAILABLE'},{status:503,headers});
 }
};}
