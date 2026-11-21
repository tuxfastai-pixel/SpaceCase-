import {z} from 'zod';import {getDatabasePool} from '../db/pool';import {boundedText} from '../http/boundedText';
import {requireSchoolFinancePermission} from './peosAuthorization';import {financeFailure} from './workspaceHttp';import {familyPlansEnabled} from '../family/activityPlanHttp';
import {linkInput,linkActivityCharge,readActivityChargeLinks} from '../../domains/school-activities/familyPlanService';import {FamilyPlanError} from '../../domains/school-activities/familyPlan';
const scope=z.object({schoolId:z.string().uuid().toLowerCase(),accountId:z.string().uuid()}).strict();
const command=scope.extend({link:linkInput}).strict(),headers={'cache-control':'private, no-store'};
export function activityChargeHandler(deps={pool:getDatabasePool,permission:requireSchoolFinancePermission}){return async(request:Request)=>{
 if(!familyPlansEnabled())return Response.json({error:'FAMILY_ACTIVITY_PLANS_NOT_ENABLED'},{status:503,headers});
 try{
  if(!['GET','POST'].includes(request.method))return Response.json({error:'METHOD_NOT_ALLOWED'},{status:405,headers});
  const params=new URL(request.url).searchParams;for(const key of params.keys())if(params.getAll(key).length!==1)throw new SyntaxError();
  if(request.method==='POST'&&(!process.env.SPACECASE_PUBLIC_URL||request.headers.get('origin')!==new URL(process.env.SPACECASE_PUBLIC_URL).origin))return Response.json({error:'FORBIDDEN'},{status:403,headers});
  if(request.method==='POST'&&params.size)throw new SyntaxError();
  const input=request.method==='POST'?command.parse(JSON.parse(await boundedText(request,2048))):scope.parse(Object.fromEntries(params));
  const authorize=(school:string,action:Parameters<typeof requireSchoolFinancePermission>[2])=>deps.permission(request,school,action);
  const decision=await authorize(input.schoolId,request.method==='POST'?'finance.transactions.record':'finance.transactions.read');
  const current={schoolId:input.schoolId,accountId:input.accountId,actorPersonId:decision.personId};
  return Response.json('link' in input?await linkActivityCharge(deps.pool(),current,linkInput.parse(input.link),authorize):await readActivityChargeLinks(deps.pool(),current,authorize),{headers});
 }catch(e){if(e instanceof FamilyPlanError)return Response.json({error:e.message},{status:409,headers});return financeFailure(e);}
};}
