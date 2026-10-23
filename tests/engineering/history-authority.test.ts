import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {founderHandler} from '../../platform/support/http';
test('history endpoint rejects non-founders, cross-origin requests and injected authority before opening storage',async()=>{
 const old=process.env.SPACECASE_PUBLIC_URL;process.env.SPACECASE_PUBLIC_URL='https://spacecase.test';let opened=false;const actor={personId:randomUUID(),founder:false,schools:[]};
 const handle=founderHandler({context:async()=>actor,pool:()=>{opened=true;throw Error('unexpected');},peos:async()=>{throw Error('unexpected');}});
 const body={action:'ENGINEERING_TASK_HISTORY',ticketId:randomUUID(),taskId:randomUUID()};const request=(payload:unknown=body,origin='https://spacecase.test')=>new Request('https://spacecase.test/api/v1/founder',{method:'POST',headers:{origin,authorization:'Bearer synthetic'},body:JSON.stringify(payload)});
 try{assert.equal((await handle(request())).status,403);actor.founder=true;assert.equal((await handle(request(body,'https://wrong.test'))).status,403);assert.equal((await handle(request({...body,sourceReference:'SC-ABCDEF012345'}))).status,400);assert.equal(opened,false);}
 finally{if(old===undefined)delete process.env.SPACECASE_PUBLIC_URL;else process.env.SPACECASE_PUBLIC_URL=old;}
});
