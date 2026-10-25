import test from 'node:test';import assert from 'node:assert/strict';
import {GET} from '../../app/api/v1/family/connections/route';
import {POST} from '../../app/api/v1/family/connections/[invitationId]/withdraw/route';
test('connection routes gate access and reject forged ownership, foreign origins and invalid withdrawal acknowledgements',async()=>{
 const old=process.env.SPACECASE_FAMILY_INVITATIONS_ENABLED,origin=process.env.SPACECASE_PUBLIC_URL;const id='123e4567-e89b-42d3-a456-426614174000';const context={params:Promise.resolve({invitationId:id})};
 try{delete process.env.SPACECASE_FAMILY_INVITATIONS_ENABLED;
 for(const response of [await GET(new Request('https://school.example/api')),await POST(new Request('https://school.example/api',{method:'POST'}),context)]){assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),'private, no-store');}
 process.env.SPACECASE_FAMILY_INVITATIONS_ENABLED='true';process.env.SPACECASE_PUBLIC_URL='https://school.example';
 for(const query of ['personId='+id,'schoolId='+id,'offset=-1','offset=1.5','offset=1000001'])assert.equal((await GET(new Request('https://school.example/api?'+query))).status,400);
 assert.equal((await POST(new Request('https://school.example/api',{method:'POST',headers:{origin:'https://foreign.example'}}),context)).status,403);
 for(const body of [{},{acknowledgement:false},{acknowledgement:true,personId:id}])assert.equal((await POST(new Request('https://school.example/api',{method:'POST',headers:{origin:'https://school.example'},body:JSON.stringify(body)}),context)).status,400);
 }finally{if(old===undefined)delete process.env.SPACECASE_FAMILY_INVITATIONS_ENABLED;else process.env.SPACECASE_FAMILY_INVITATIONS_ENABLED=old;if(origin===undefined)delete process.env.SPACECASE_PUBLIC_URL;else process.env.SPACECASE_PUBLIC_URL=origin;}
});
