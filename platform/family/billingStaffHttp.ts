import {z} from 'zod';import {familyFinanceEnabled} from './billingAuthority';import {boundedText} from '../http/boundedText';import {peosProxy} from '../admin/peosProxy';
const schema=z.object({schoolId:z.string().uuid().toLowerCase(),grantId:z.string().uuid().toLowerCase().optional()}).strict();
export async function familyBillingStaff(request:Request){const headers={'cache-control':'private, no-store'};if(!familyFinanceEnabled())return Response.json({error:'FAMILY_FINANCE_NOT_ENABLED'},{status:503,headers});try{
 const params=new URL(request.url).searchParams;for(const key of params.keys())if(params.getAll(key).length!==1)throw new SyntaxError();const input=schema.parse(Object.fromEntries(params));
 if(!['GET','POST'].includes(request.method)||(request.method==='GET'&&input.grantId))return Response.json({error:'INVALID_INPUT'},{status:400,headers});
 const body=request.method==='POST'?JSON.parse(await boundedText(request,2048)):undefined;
 return peosProxy(request,`/v1/finance/schools/${input.schoolId}/family-billing${input.grantId?`/${input.grantId}`:''}`,body);
 }catch{return Response.json({error:'INVALID_INPUT'},{status:400,headers});}}
