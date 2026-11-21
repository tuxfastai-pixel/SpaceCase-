import test from 'node:test';
import assert from 'node:assert/strict';
import {intakeHandler} from '../../platform/finance/intakeHttp';
test('intake defaults off and rejects cross-origin/invalid scope before database access',async()=>{
 const saved={...process.env};let calls=0;
 const handler=intakeHandler({pool:()=>{calls++;throw Error('unexpected database access');},permission:async()=>{throw Error('unexpected permission call');}});
 try{
  delete process.env.SPACECASE_FINANCE_INTAKE_ENABLED;
  assert.equal((await handler(new Request('https://school.test/api/finance/intake'))).status,503);
  Object.assign(process.env,{SPACECASE_FINANCE_INTAKE_ENABLED:'true',SPACECASE_FINANCE_WORKSPACE_ENABLED:'true',SPACECASE_WORKSPACE_MODE:'operational',SPACECASE_PUBLIC_URL:'https://school.test'});
  assert.equal((await handler(new Request('https://school.test/api/finance/intake',{method:'POST',headers:{origin:'https://other.test'},body:'{}'}))).status,403);
  assert.equal((await handler(new Request('https://school.test/api/finance/intake?schoolId=bad&accountId=bad'))).status,400);
  process.env.SPACECASE_WORKSPACE_MODE='authority_only';
  assert.equal((await handler(new Request('https://school.test/api/finance/intake'))).status,503);
  assert.equal(calls,0);
 }finally{for(const key of ['SPACECASE_FINANCE_INTAKE_ENABLED','SPACECASE_FINANCE_WORKSPACE_ENABLED','SPACECASE_WORKSPACE_MODE','SPACECASE_PUBLIC_URL']){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}}
});
