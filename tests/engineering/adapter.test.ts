import test from 'node:test';import assert from 'node:assert/strict';import type {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {saveEngineeringTask} from '../../platform/support/engineeringAdapter';
import {founderHandler} from '../../platform/support/http';
const input={ticketId:randomUUID(),revision:0,requestId:randomUUID(),baseCommit:'a'.repeat(40),privacyReviewed:true as const,consentToStore:true as const,brief:{problem:'Synthetic date does not advance.',expected:'Advance to month.',observed:'Focus stays in year.',steps:['Enter four digits.'],acceptance:['Focus moves to month.']}};
test('product adapter requires founder authority, explicit storage consent and production configuration before storage',async()=>{
 let touched=false;const pool={connect:async()=>{touched=true;throw Error('unexpected');}} as unknown as Pool;
 const c={personId:randomUUID(),founder:true,schools:[]};const deps={env:()=>({VERCEL_ENV:'production'}),now:()=>1000,fetch:async()=>{touched=true;throw Error('unexpected');}};
 await assert.rejects(saveEngineeringTask(pool,{...c,founder:false},input,deps),/FOUNDER_REQUIRED/);
 await assert.rejects(saveEngineeringTask(pool,c,{...input,consentToStore:false} as unknown as typeof input,deps));
 await assert.rejects(saveEngineeringTask(pool,c,input,deps),/ENGINEERING_LEDGER_DISABLED/);
 await assert.rejects(saveEngineeringTask(pool,c,input,{...deps,env:()=>({VERCEL_ENV:'preview',SPACECASE_ENGINEERING_LEDGER_ENABLED:'true'})}),/ENGINEERING_LEDGER_DISABLED/);
 assert.equal(touched,false);
});
test('founder save endpoint denies non-founder and unexpected authority fields before pooling',async()=>{
 const old=process.env.SPACECASE_PUBLIC_URL;process.env.SPACECASE_PUBLIC_URL='https://spacecase.test';
 let opened=false;const c={personId:randomUUID(),founder:false,schools:[]};
 const deps={context:async()=>c,pool:()=>{opened=true;throw Error('unexpected');},peos:async()=>{throw Error('unexpected');}};
 const make=(body:unknown)=>new Request('https://spacecase.test/api/v1/founder',{method:'POST',headers:{origin:'https://spacecase.test',authorization:'Bearer synthetic'},body:JSON.stringify(body)});
 try{assert.equal((await founderHandler(deps)(make({action:'SAVE_ENGINEERING_TASK',...input}))).status,403);
 c.founder=true;
 assert.equal((await founderHandler(deps)(make({action:'SAVE_ENGINEERING_TASK',...input,actorPersonId:randomUUID()}))).status,400);
 assert.equal((await founderHandler(deps)(make({action:'SAVE_ENGINEERING_TASK',...input,consentToStore:false}))).status,400);
 assert.equal(opened,false);
 }finally{if(old===undefined)delete process.env.SPACECASE_PUBLIC_URL;else process.env.SPACECASE_PUBLIC_URL=old;}
});
