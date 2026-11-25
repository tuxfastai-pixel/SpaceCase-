import {z} from 'zod';
import {familyFinanceEnabled,requireFamilyBilling,FamilyBillingError} from './billingAuthority';
import {getDatabasePool} from '../db/pool';
import {boundedText} from '../http/boundedText';
import {FamilyPlanError,familyPlanChoice,familyPlanDraft} from '../../domains/school-activities/familyPlan';
import {acceptFamilyActivityPlan,previewFamilyActivityPlan,readFamilyActivityPlans} from '../../domains/school-activities/familyPlanService';
export const familyPlansEnabled=()=>familyFinanceEnabled()&&process.env.SPACECASE_ACTIVITY_REGISTER_ENABLED==='true'&&process.env.SPACECASE_FAMILY_ACTIVITY_PLANS_ENABLED==='true';
const uuid=z.string().uuid().toLowerCase(),headers={'cache-control':'private, no-store'};
const query=z.object({grantId:uuid,requestId:uuid.optional()}).strict();
const command=z.discriminatedUnion('command',[
 z.object({command:z.literal('PREVIEW'),grantId:uuid,choice:familyPlanDraft}).strict(),
 z.object({command:z.literal('ACCEPT'),grantId:uuid,choice:familyPlanChoice,reviewDigest:z.string().regex(/^[a-f0-9]{64}$/)}).strict(),
]);
const defaults={pool:getDatabasePool,authorize:requireFamilyBilling,read:readFamilyActivityPlans,preview:previewFamilyActivityPlan,accept:acceptFamilyActivityPlan};
export function familyActivityPlanHandler(deps=defaults){return async(request:Request)=>{
 if(!familyPlansEnabled())return Response.json({error:'FAMILY_ACTIVITY_PLANS_NOT_ENABLED'},{status:503,headers});
 try{
  if(!['GET','POST'].includes(request.method))return Response.json({error:'METHOD_NOT_ALLOWED'},{status:405,headers});
  const params=new URL(request.url).searchParams;for(const key of params.keys())if(params.getAll(key).length!==1)throw new SyntaxError();
  if(request.method==='GET'){
   const input=query.parse(Object.fromEntries(params));return Response.json(await deps.read(deps.pool(),input.grantId,id=>deps.authorize(request,id,'family.finance.read'),input.requestId),{headers});
  }
  if(!process.env.SPACECASE_PUBLIC_URL||request.headers.get('origin')!==new URL(process.env.SPACECASE_PUBLIC_URL).origin)return Response.json({error:'FORBIDDEN'},{status:403,headers});
  if(params.size)throw new SyntaxError();
  const input=command.parse(JSON.parse(await boundedText(request,24000)));
  const authorize=(id:string)=>deps.authorize(request,id,'family.finance.plan.accept');
  const result=input.command==='PREVIEW'?await deps.preview(deps.pool(),input.grantId,{...input.choice,agreementChecked:true},authorize):await deps.accept(deps.pool(),input.grantId,input.choice,authorize,input.reviewDigest);
  return Response.json(result,{headers});
 }catch(e){
  if(e instanceof FamilyBillingError)return Response.json({error:e.code},{status:e.status,headers});
  if(e instanceof z.ZodError||e instanceof SyntaxError)return Response.json({error:'INVALID_INPUT'},{status:400,headers});
  if(e instanceof RangeError)return Response.json({error:'REQUEST_TOO_LARGE'},{status:413,headers});
  if(e instanceof FamilyPlanError)return Response.json({error:e.message},{status:409,headers});
  return Response.json({error:'FAMILY_ACTIVITY_PLANS_UNAVAILABLE'},{status:503,headers});
 }
};}
