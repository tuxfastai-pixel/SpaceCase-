import {test} from 'node:test';import assert from 'node:assert/strict';import {activityRegisterHandler} from '../../platform/finance/activityRegisterHttp';
test('activity register defaults off and rejects cross-origin, repeated scopes and unknown fields before storage',async()=>{
 const keys=['SPACECASE_ACTIVITY_REGISTER_ENABLED','SPACECASE_FINANCE_WORKSPACE_ENABLED','SPACECASE_WORKSPACE_MODE','SPACECASE_PUBLIC_URL'];const original={...process.env};let reads=0;
 const handler=activityRegisterHandler({pool:()=>{reads++;throw Error('storage not expected');},permission:async()=>{throw Error('permission not expected');}});
 try{
  delete process.env.SPACECASE_ACTIVITY_REGISTER_ENABLED;assert.equal((await handler(new Request('https://school.test/api/finance/activities'))).status,503);
  Object.assign(process.env,{SPACECASE_ACTIVITY_REGISTER_ENABLED:'true',SPACECASE_FINANCE_WORKSPACE_ENABLED:'true',SPACECASE_WORKSPACE_MODE:'operational',SPACECASE_PUBLIC_URL:'https://school.test'});
  assert.equal((await handler(new Request('https://school.test/api/finance/activities',{method:'POST',headers:{origin:'https://other.test'},body:'{}'}))).status,403);
  assert.equal((await handler(new Request('https://school.test/api/finance/activities?schoolId=x&schoolId=y'))).status,400);
  assert.equal((await handler(new Request('https://school.test/api/finance/activities?schoolId=10000000-0000-4000-8000-000000000001&accountId=10000000-0000-4000-8000-000000000002&unexpected=true'))).status,400);
  assert.equal(reads,0);
 }finally{for(const k of keys){if(original[k]===undefined)delete process.env[k];else process.env[k]=original[k];}}
});
