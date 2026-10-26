import test from 'node:test';import assert from 'node:assert/strict';
import {beginGoogleSignIn} from '../../platform/auth/beginGoogleSignIn';import {adminSchools} from '../../platform/admin/peosProxy';
const config={origin:'https://school.example',providerOrigin:'https://auth.example'};
const clear=async()=>new Response(null,{headers:{'set-cookie':'peos_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure'}});
test('account switching clears the previous local session before starting OAuth and on failure',async()=>{
 const order:string[]=[];const result=await beginGoogleSignIn(config,async()=>{order.push('clear');return clear();},async()=>{order.push('oauth');return{data:{url:'https://auth.example/authorize'},error:null};});assert.deepEqual(order,['clear','oauth']);assert.match(result.cookie,/Max-Age=0/);assert.equal(result.destination,'https://auth.example/authorize');
 for(const start of [async()=>({data:{url:null},error:Error('private')}),async()=>{throw Error('private');},async()=>({data:{url:'https://evil.example/authorize'},error:null})]){const failed=await beginGoogleSignIn(config,clear,start);assert.equal(failed.destination,'https://school.example/login?error=signin');assert.match(failed.cookie,/Max-Age=0/);assert.equal(JSON.stringify(failed).includes('private'),false);}
 await assert.rejects(beginGoogleSignIn(config,async()=>new Response(null),async()=>{throw Error('must not start');}),/SESSION_CLEAR_UNAVAILABLE/);
});
test('workspace role lookup cannot turn service failures or malformed authority into teacher fallback',async()=>{
 const before=process.env.PEOS_BASE_URL;process.env.PEOS_BASE_URL='https://peos.example';try{
 for(const status of [401,403,503])await assert.rejects(adminSchools('Bearer synthetic',async()=>Response.json({error:'unavailable'},{status})),/WORKSPACE_AUTHORITY_UNAVAILABLE/);
 await assert.rejects(adminSchools('Bearer synthetic',async()=>Response.json({schools:[{id:'broken',principal:true}]})));
 const schools=await adminSchools('Bearer synthetic',async()=>Response.json({schools:[{id:'123e4567-e89b-42d3-a456-426614174000',displayName:'Example',principal:true}]}));assert.equal(schools[0].principal,true);
 }finally{if(before===undefined)delete process.env.PEOS_BASE_URL;else process.env.PEOS_BASE_URL=before;}
});
