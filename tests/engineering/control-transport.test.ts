import test from 'node:test';import assert from 'node:assert/strict';import {generateKeyPairSync,randomUUID} from 'node:crypto';
import {signTaskControl,verifyTaskControl} from '../../packages/engineering-control/control-transport';
const keys=generateKeyPairSync('ed25519'),actor={founder:true,personId:randomUUID()},ref='SC-ABCDEF012345';
test('task controls bind purpose/source/revision and reject forgery, expiry and privilege injection',()=>{
 for(const input of [{purpose:'LIST_TICKET_TASKS' as const,sourceReference:ref,offset:0},{purpose:'CANCEL_TASK' as const,sourceReference:ref,taskId:randomUUID(),revision:3}]){
  const token=signTaskControl(input,actor,keys.privateKey,1000);assert.deepEqual(verifyTaskControl(token,keys.publicKey,1029).input,input);
  assert.throws(()=>verifyTaskControl(token,keys.publicKey,1030));assert.throws(()=>verifyTaskControl(token,generateKeyPairSync('ed25519').publicKey,1000));assert.throws(()=>signTaskControl(input,{...actor,founder:false},keys.privateKey,1000));
 }
 for(const bad of [{purpose:'EXECUTE',sourceReference:ref},{purpose:'LIST_TICKET_TASKS',sourceReference:ref,offset:0,founder:true},{purpose:'CANCEL_TASK',sourceReference:ref,taskId:randomUUID(),revision:-1}])assert.throws(()=>signTaskControl(bad as never,actor,keys.privateKey,1000));
});
