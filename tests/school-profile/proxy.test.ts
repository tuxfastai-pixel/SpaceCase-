import test from 'node:test';
import assert from 'node:assert/strict';
import {peosProxy} from '../../platform/admin/peosProxy';

test('school profile proxy rejects unsigned and cross-origin writes and preserves conflict responses',async()=>{
 const oldUrl=process.env.SPACECASE_PUBLIC_URL,oldPeos=process.env.PEOS_BASE_URL,realFetch=globalThis.fetch;
 process.env.SPACECASE_PUBLIC_URL='https://school.example';process.env.PEOS_BASE_URL='https://peos.example';
 let calls=0;
 globalThis.fetch=(async(input:URL|RequestInfo,init?:RequestInit)=>{calls++;assert.equal(String(input),'https://peos.example/v1/admin/schools/school-a/profile');assert.equal(init?.method,'PUT');assert.equal(init?.cache,'no-store');return Response.json({error:'PROFILE_CONFLICT'},{status:409});}) as typeof fetch;
 try{
  assert.equal((await peosProxy(new Request('https://school.example/api/profile',{method:'PUT',headers:{origin:'https://other.example',authorization:'Bearer example'}}),'/v1/admin/schools/school-a/profile',{})).status,403);
  assert.equal((await peosProxy(new Request('https://school.example/api/profile'),'/v1/admin/schools/school-a/profile')).status,401);
  assert.equal(calls,0);
  const result=await peosProxy(new Request('https://school.example/api/profile',{method:'PUT',headers:{origin:'https://school.example',authorization:'Bearer example'}}),'/v1/admin/schools/school-a/profile',{revision:1});
  assert.equal(result.status,409);assert.equal(result.headers.get('cache-control'),'no-store');assert.equal(calls,1);
 }finally{globalThis.fetch=realFetch;if(oldUrl===undefined)delete process.env.SPACECASE_PUBLIC_URL;else process.env.SPACECASE_PUBLIC_URL=oldUrl;if(oldPeos===undefined)delete process.env.PEOS_BASE_URL;else process.env.PEOS_BASE_URL=oldPeos;}
});
