import {z} from 'zod';import {familyFinanceEnabled,listBillingScopes,requireFamilyBilling,FamilyBillingError} from './billingAuthority';
import {getDatabasePool} from '../db/pool';import {readFamilyFinanceAccount} from '../../domains/school-finance/familyAccount';
const headers={'cache-control':'private, no-store'};
export function familyFinanceHandler(deps={pool:getDatabasePool,scopes:listBillingScopes,authorize:requireFamilyBilling}){return async(request:Request)=>{
 if(!familyFinanceEnabled())return Response.json({error:'FAMILY_FINANCE_NOT_ENABLED'},{status:503,headers});
 try{if(request.method!=='GET')return Response.json({error:'METHOD_NOT_ALLOWED'},{status:405,headers});const params=new URL(request.url).searchParams;for(const key of params.keys())if(params.getAll(key).length!==1)throw new SyntaxError();
 const input=z.object({grantId:z.string().uuid().toLowerCase().optional()}).strict().parse(Object.fromEntries(params));
 const result=input.grantId?await readFamilyFinanceAccount(deps.pool(),input.grantId,id=>deps.authorize(request,id,'family.finance.read')):await deps.scopes(request);return Response.json(result,{headers});
 }catch(e){if(e instanceof FamilyBillingError)return Response.json({error:e.code},{status:e.status,headers});if(e instanceof z.ZodError||e instanceof SyntaxError)return Response.json({error:'INVALID_INPUT'},{status:400,headers});return Response.json({error:'FAMILY_FINANCE_UNAVAILABLE'},{status:503,headers});}
};}
