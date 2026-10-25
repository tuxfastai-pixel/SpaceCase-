import test from 'node:test';import assert from 'node:assert/strict';
import {GET,POST} from '../../app/api/v1/admin/schools/[schoolId]/family-invitations/route';
import {PATCH} from '../../app/api/v1/admin/schools/[schoolId]/family-invitations/[invitationId]/route';
import {POST as pending} from '../../app/api/v1/family/invitation/pending/route';
import {POST as claim} from '../../app/api/v1/family/invitation/claim/route';
test('family invitation routes are disabled by default and reject foreign-origin mutations before identity access',async()=>{
 const previous=process.env.SPACECASE_FAMILY_INVITATIONS_ENABLED,origin=process.env.SPACECASE_PUBLIC_URL;const id='123e4567-e89b-42d3-a456-426614174000';const context={params:Promise.resolve({schoolId:id,invitationId:id})};try{
 delete process.env.SPACECASE_FAMILY_INVITATIONS_ENABLED;const get=new Request('https://school.example/api');assert.equal((await GET(get,context)).status,503);for(const handler of [pending,claim])assert.equal((await handler(new Request('https://school.example/api',{method:'POST'}))).status,503);assert.equal((await POST(new Request('https://school.example/api',{method:'POST'}),context)).status,503);assert.equal((await PATCH(new Request('https://school.example/api',{method:'PATCH'}),context)).status,503);
 process.env.SPACECASE_FAMILY_INVITATIONS_ENABLED='true';process.env.SPACECASE_PUBLIC_URL='https://school.example';for(const handler of [pending,claim])assert.equal((await handler(new Request('https://school.example/api',{method:'POST',headers:{origin:'https://evil.example'}}))).status,403);assert.equal((await POST(new Request('https://school.example/api',{method:'POST',headers:{origin:'https://evil.example'}}),context)).status,403);assert.equal((await PATCH(new Request('https://school.example/api',{method:'PATCH',headers:{origin:'https://evil.example'}}),context)).status,403);
 }finally{if(previous===undefined)delete process.env.SPACECASE_FAMILY_INVITATIONS_ENABLED;else process.env.SPACECASE_FAMILY_INVITATIONS_ENABLED=previous;if(origin===undefined)delete process.env.SPACECASE_PUBLIC_URL;else process.env.SPACECASE_PUBLIC_URL=origin;}
});
