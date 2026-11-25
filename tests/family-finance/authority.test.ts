import {test} from 'node:test';import assert from 'node:assert/strict';import {requireFamilyBilling,listBillingScopes} from '../../platform/family/billingAuthority';import {familyFinanceHandler} from '../../platform/family/financeHttp';
const grantId='10000000-0000-4000-8000-000000000001';const good=()=>({allowed:true,contractVersion:'family-billing-v1',grantId,personId:'10000000-0000-4000-8000-000000000002',schoolId:'10000000-0000-4000-8000-000000000003',learnerPersonId:'10000000-0000-4000-8000-000000000004',action:'family.finance.read',expiresAt:new Date(Date.now()+30000).toISOString()});
test('family authority requires exact version, grant, action and fresh bounded expiry without role fallback',async()=>{
 const old=process.env.PEOS_BASE_URL;process.env.PEOS_BASE_URL='https://peos.test';const request=new Request('https://school.test',{headers:{authorization:'Bearer example-session'}});
 try{let payload='';const fetcher:typeof fetch=async(_url,init)=>{payload=String(init?.body);return Response.json(good());};assert.equal((await requireFamilyBilling(request,grantId,'family.finance.read',fetcher)).learnerPersonId,good().learnerPersonId);assert.deepEqual(JSON.parse(payload),{action:'family.finance.read'});
 for(const change of [{contractVersion:'unknown'},{grantId:good().schoolId},{action:'family.finance.plan.accept'},{expiresAt:new Date(Date.now()-1000).toISOString()},{expiresAt:new Date(Date.now()+3600000).toISOString()},{allowed:false},{role:'PARENT'}])await assert.rejects(requireFamilyBilling(request,grantId,'family.finance.read',async()=>Response.json({...good(),...change})),/FAMILY_BILLING_FORBIDDEN/);
 await assert.rejects(requireFamilyBilling(new Request('https://school.test'),grantId,'family.finance.read',fetcher),/UNAUTHENTICATED/);
 await assert.rejects(listBillingScopes(request,async()=>Response.json({contractVersion:'family-billing-v1',scopes:[],truncated:false,allLearners:[]})),/FAMILY_BILLING_UNAVAILABLE/);
 }finally{if(old===undefined)delete process.env.PEOS_BASE_URL;else process.env.PEOS_BASE_URL=old;}
});
test('family finance stays off by default and rejects client school/learner claims before storage',async()=>{
 const original={...process.env};let calls=0;const handler=familyFinanceHandler({pool:()=>{calls++;throw Error('not expected');},scopes:async()=>{throw Error('not expected');},authorize:async()=>{throw Error('not expected');}});
 const keys=['SPACECASE_FAMILY_FINANCE_ENABLED','SPACECASE_FINANCE_WORKSPACE_ENABLED','SPACECASE_WORKSPACE_MODE'];
 try{delete process.env.SPACECASE_FAMILY_FINANCE_ENABLED;assert.equal((await handler(new Request('https://school.test/api/v1/family/finance'))).status,503);Object.assign(process.env,{SPACECASE_FAMILY_FINANCE_ENABLED:'true',SPACECASE_FINANCE_WORKSPACE_ENABLED:'true',SPACECASE_WORKSPACE_MODE:'operational'});
 for(const q of ['schoolId=forged','learnerPersonId=forged',`grantId=${grantId}&grantId=${grantId}`])assert.equal((await handler(new Request(`https://school.test/api/v1/family/finance?${q}`))).status,400);assert.equal(calls,0);
 }finally{for(const key of keys){if(original[key]===undefined)delete process.env[key];else process.env[key]=original[key];}}
});
