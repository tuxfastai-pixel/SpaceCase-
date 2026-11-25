import {z} from 'zod';
import {readServerEnvironment} from '../config/env';
import {resolvePeosAuthorization} from '../session/peosAuthorization';
import {peosPreviewHeaders} from '../peos/previewHeaders';
import {familyBillingAction,familyBillingDecision,familyBillingDirectory} from './billingContracts';
export type {FamilyBillingDecision} from './billingContracts';
export class FamilyBillingError extends Error{constructor(public status:number,public code:string){super(code);}}
export const familyFinanceEnabled=()=>process.env.SPACECASE_FAMILY_FINANCE_ENABLED==='true'&&process.env.SPACECASE_FINANCE_WORKSPACE_ENABLED==='true'&&process.env.SPACECASE_WORKSPACE_MODE!=='authority_only';
async function peosBilling(request:Request,path:string,body:unknown|undefined,fetchImpl:typeof fetch){
 const authorization=resolvePeosAuthorization(request),env=readServerEnvironment();if(!authorization)throw new FamilyBillingError(401,'UNAUTHENTICATED');if(!env.PEOS_BASE_URL)throw new FamilyBillingError(503,'FAMILY_BILLING_UNAVAILABLE');
 let response:Response;
 try{response=await fetchImpl(new URL(path,env.PEOS_BASE_URL),{method:body===undefined?'GET':'POST',headers:{authorization,accept:'application/json','content-type':'application/json',...peosPreviewHeaders(process.env.VERCEL_ENV==='preview'?request.headers.get('x-vercel-oidc-token'):null)},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(10000)});}catch{throw new FamilyBillingError(503,'FAMILY_BILLING_UNAVAILABLE');}
 if(!response.ok)throw new FamilyBillingError([401,403].includes(response.status)?response.status:503,response.status===401?'UNAUTHENTICATED':response.status===403?'FAMILY_BILLING_FORBIDDEN':'FAMILY_BILLING_UNAVAILABLE');
 try{return await response.json();}catch{throw new FamilyBillingError(503,'FAMILY_BILLING_UNAVAILABLE');}
}
export async function requireFamilyBilling(request:Request,grantId:string,action:z.infer<typeof familyBillingAction>,fetchImpl:typeof fetch=fetch){
 const id=z.string().uuid().transform(v=>v.toLowerCase()).parse(grantId),permission=familyBillingAction.parse(action);
 const parsed=familyBillingDecision.safeParse(await peosBilling(request,`/v1/family/billing/${id}/authorize`,{action:permission},fetchImpl));
 if(!parsed.success||parsed.data.grantId!==id||parsed.data.action!==permission||Date.parse(parsed.data.expiresAt)<=Date.now()||Date.parse(parsed.data.expiresAt)>Date.now()+60000)throw new FamilyBillingError(403,'FAMILY_BILLING_FORBIDDEN');return parsed.data;
}
export async function listBillingScopes(request:Request,fetchImpl:typeof fetch=fetch){const parsed=familyBillingDirectory.safeParse(await peosBilling(request,'/v1/family/billing',undefined,fetchImpl));if(!parsed.success)throw new FamilyBillingError(503,'FAMILY_BILLING_UNAVAILABLE');return parsed.data;}
