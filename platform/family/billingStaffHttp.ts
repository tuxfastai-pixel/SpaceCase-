import {participationEnabled} from './participationHttp';
import {z} from 'zod';import {paymentProofsEnabled} from './proofConfig';import {familyPlansEnabled} from './activityPlanHttp';import {familyFinanceEnabled} from './billingAuthority';import {boundedText} from '../http/boundedText';import {peosProxy} from '../admin/peosProxy';
const schema=z.object({schoolId:z.string().uuid().toLowerCase(),grantId:z.string().uuid().toLowerCase().optional()}).strict();
export async function familyBillingStaff(request:Request){const headers={'cache-control':'private, no-store'};if(!familyFinanceEnabled())return Response.json({error:'FAMILY_FINANCE_NOT_ENABLED'},{status:503,headers});try{
 const params=new URL(request.url).searchParams;for(const key of params.keys())if(params.getAll(key).length!==1)throw new SyntaxError();const input=schema.parse(Object.fromEntries(params));
 if(!['GET','POST'].includes(request.method)||(request.method==='GET'&&input.grantId))return Response.json({error:'INVALID_INPUT'},{status:400,headers});
 const body=request.method==='POST'?JSON.parse(await boundedText(request,2048)):undefined;
 if(body&&!input.grantId&&Array.isArray(body.actions)&&body.actions.some((action:unknown)=>action!=='family.finance.read'&&(action!=='family.finance.plan.accept'||!familyPlansEnabled())&&(action!=='family.finance.proof.submit'||!paymentProofsEnabled())&&(action!=='family.finance.activity.accept'||!participationEnabled())))return Response.json({error:'FAMILY_PLAN_PERMISSION_NOT_ENABLED'},{status:403,headers});
 return peosProxy(request,`/v1/finance/schools/${input.schoolId}/family-billing${input.grantId?`/${input.grantId}`:''}`,body);
 }catch{return Response.json({error:'INVALID_INPUT'},{status:400,headers});}}
