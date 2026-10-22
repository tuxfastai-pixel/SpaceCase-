import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {founderHandler} from '../../platform/support/http';import {peosRead} from '../../platform/support/authority';
const payload={action:'ENGINEERING_HANDOFF',ticketId:randomUUID(),revision:0,brief:{problem:'Synthetic date entry is broken.',expected:'Move from year to month.',observed:'Focus remains in year.',steps:['Type four digits.'],acceptance:['Month receives focus.']},privacyReviewed:true};
function req(data:unknown,origin='https://school.example',signed=true){return new Request('https://school.example/api/v1/founder',{method:'POST',headers:{origin,'content-type':'application/json',...(signed?{authorization:'Bearer scoped'}:{})},body:JSON.stringify(data)});}
test('handoff requests require fresh founder authority, origin, review and valid fields before storage',async()=>{
 const old=process.env.SPACECASE_PUBLIC_URL;process.env.SPACECASE_PUBLIC_URL='https://school.example';let storage=0,authority=0;let founder=false;
 const handle=founderHandler({context:async()=>{authority++;return {personId:randomUUID(),founder,schools:[]};},pool:()=>{storage++;throw Error('must not reach storage');},peos:peosRead});
 try{assert.equal((await handle(req(payload,'https://other.example'))).status,403);assert.equal((await handle(req(payload,undefined,false))).status,401);assert.equal(authority,0);
 assert.equal((await handle(req(payload))).status,403);founder=true;
 for(const value of [{...payload,privacyReviewed:false},{...payload,repository:'other/repo'},{...payload,brief:{...payload.brief,schoolId:'private'}}])assert.equal((await handle(req(value))).status,400);
 assert.equal(storage,0);founder=false;assert.equal((await handle(req(payload))).status,403);assert.equal(storage,0);
 }finally{if(old===undefined)delete process.env.SPACECASE_PUBLIC_URL;else process.env.SPACECASE_PUBLIC_URL=old;}
});
