import test from 'node:test';import assert from 'node:assert/strict';import type {Pool} from 'pg';import {financeHandler} from '../../platform/school-finance/http';import {FinanceError,financeCommand} from '../../domains/school-finance/contracts';
const school='11111111-1111-4111-8111-111111111111',actor='22222222-2222-4222-8222-222222222222';
test('finance HTTP denies cross-origin, unsigned, revoked, mismatched and forged authority before storage',async()=>{
 const old=process.env.SPACECASE_PUBLIC_URL;process.env.SPACECASE_PUBLIC_URL='https://school.example';let pools=0;let contextCalls=0;
 const context={personId:actor,schoolId:school,displayName:'School',principal:false,learner:null};
 const session=async()=>({personId:actor,sessionId:'session',issuedAt:'2026-01-01T00:00:00Z',expiresAt:'2100-01-01T00:00:00Z'});
 const handler=financeHandler({session,context:async()=>{contextCalls++;return context;},pool:()=>{pools++;throw Error('must not open database');}});
 try{
  assert.equal((await handler(new Request('https://school.example/api/finance',{method:'POST',headers:{origin:'https://other.example',authorization:'Bearer example'},body:'{}'}),school)).status,403);
  assert.equal((await handler(new Request('https://school.example/api/finance'),school)).status,401);
  assert.equal((await handler(new Request('https://school.example/api/finance',{method:'POST',headers:{origin:'https://school.example',authorization:'Bearer example'},body:JSON.stringify({action:'CREATE_ACCOUNT',learnerPersonId:actor,principal:true})}),school)).status,400);
  const wrong=financeHandler({session,context:async()=>({...context,personId:school}),pool:()=>{pools++;return {} as Pool;}});assert.equal((await wrong(new Request('https://school.example/api/finance',{headers:{authorization:'Bearer example'}}),school)).status,503);
  const revoked=financeHandler({session,context:async()=>{throw new FinanceError('SCHOOL_FINANCE_REQUIRED');},pool:()=>{pools++;return {} as Pool;}});assert.equal((await revoked(new Request('https://school.example/api/finance',{headers:{authorization:'Bearer example'}}),school)).status,403);
  assert.equal(pools,0);assert.equal(contextCalls,0);
 }finally{if(old===undefined)delete process.env.SPACECASE_PUBLIC_URL;else process.env.SPACECASE_PUBLIC_URL=old;}
});
test('finance commands reject trusted flags, malformed dates and arbitrary balances',()=>{
 assert.equal(financeCommand.safeParse({action:'VERIFY_PAYMENT',paymentId:actor,revision:1,reason:'Bank check',checkedAgainstSchoolRecords:false}).success,false);
 assert.equal(financeCommand.safeParse({action:'REPORT_PAYMENT',requestKey:actor,accountId:actor,reference:'bank',amountMinor:'100',receivedOn:'2026-02-30',method:'EFT'}).success,false);
 assert.equal(financeCommand.safeParse({action:'ALLOCATE_PAYMENT',requestKey:actor,accountId:actor,paymentId:actor,invoiceId:actor,amountMinor:'100',availableMinor:'10000',verification:'VERIFIED'}).success,false);
});
