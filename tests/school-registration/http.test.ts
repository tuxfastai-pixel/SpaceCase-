import test from 'node:test';import assert from 'node:assert/strict';import {registrationProxy} from '../../platform/onboarding/registrationProxy';import {requestList,detailSchema} from '../../platform/onboarding/registration';
test('school registration proxy rejects foreign origins, unsigned users and oversized bodies before upstream',async()=>{
 const oldUrl=process.env.SPACECASE_PUBLIC_URL,oldPeos=process.env.PEOS_BASE_URL,realFetch=globalThis.fetch;
 process.env.SPACECASE_PUBLIC_URL='https://school.example';process.env.PEOS_BASE_URL='https://peos.example';let calls=0;
 globalThis.fetch=(async()=>{calls++;return Response.json({error:'INDEPENDENT_REVIEW_REQUIRED'},{status:403});}) as typeof fetch;
 try{
  const path='/v1/school-registration/requests';
  assert.equal((await registrationProxy(new Request('https://school.example/api/registration',{method:'POST',headers:{origin:'https://other.example',authorization:'Bearer example'},body:'{}'}),path)).status,403);
  assert.equal((await registrationProxy(new Request('https://school.example/api/registration',{method:'POST',headers:{origin:'https://school.example'},body:'{}'}),path)).status,401);
  assert.equal((await registrationProxy(new Request('https://school.example/api/registration',{method:'POST',headers:{origin:'https://school.example',authorization:'Bearer example'},body:'x'.repeat(8193)}),path)).status,400);
  assert.equal(calls,0);
  const denied=await registrationProxy(new Request('https://school.example/api/review',{method:'PATCH',headers:{origin:'https://school.example',authorization:'Bearer example'},body:'{"revision":1}'}),'/v1/spacecase/founder/registrations/123');assert.equal(denied.status,403);assert.equal(calls,1);
 }finally{globalThis.fetch=realFetch;if(oldUrl===undefined)delete process.env.SPACECASE_PUBLIC_URL;else process.env.SPACECASE_PUBLIC_URL=oldUrl;if(oldPeos===undefined)delete process.env.PEOS_BASE_URL;else process.env.PEOS_BASE_URL=oldPeos;}
});
test('registration responses cannot claim an approved school or granted authority',()=>{
 const request={id:'12345678-1234-4234-8234-123456789012',schoolName:'School',applicantRole:'PRINCIPAL',status:'APPROVED',revision:1,reviewMessage:'',createdAt:'2026-10-28',updatedAt:'2026-10-28'};
 assert.equal(requestList.safeParse({requests:[request],nextOffset:null}).success,false);
 assert.equal(detailSchema.safeParse({request:{...request,status:'SUBMITTED',principalEmail:'school@example.test',profile:{},requesterPersonId:request.id},possibleExistingSchools:[],grantsAuthority:true}).success,false);
});
