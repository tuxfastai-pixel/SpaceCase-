import test from 'node:test';
import assert from 'node:assert/strict';
import {IntakeRequestError,intakeRequestError,intakeRequestTimeout} from '../../app/finance/intakeRequest';
test('intake timeout gives a next step without exposing raw transport errors',()=>{
 const timeout=new DOMException('signal timed out','TimeoutError');
 assert.match(intakeRequestError(timeout,'queue'),/Refresh queue/);
 assert.match(intakeRequestError(timeout,'preview'),/Preview receipts/);
 assert.doesNotMatch(intakeRequestError(timeout,'preview'),/signal timed out/);
 assert.ok(intakeRequestTimeout.queue>15_000);
});
test('unknown financial-write outcomes never claim failure or invite an unchecked retry',()=>{
 for(const error of [new DOMException('signal timed out','TimeoutError'),new TypeError('fetch failed'),new Error('private connection detail')]){
  const message=intakeRequestError(error,'write');
  assert.match(message,/may already have completed/);
  assert.match(message,/check Fees & receipts before trying again/);
  assert.doesNotMatch(message,/private connection detail|fetch failed|signal timed out/);
 }
});
test('known validated API decisions remain actionable without disclosing arbitrary exceptions',()=>{
 assert.equal(intakeRequestError(new IntakeRequestError('Preview this file again.'),'preview'),'Preview this file again.');
 assert.doesNotMatch(intakeRequestError(new Error('private connection detail'),'queue'),/private connection detail/);
});
