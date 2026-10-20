import assert from "node:assert/strict";
import test from "node:test";
import {randomUUID} from "node:crypto";
import {billingHandler} from "../../platform/billing/http";
import {SupportError} from "../../domains/support/contracts";
import {peosRead} from "../../platform/support/authority";
test("billing denies unsigned, cross-origin, non-founder and teacher reads before storage",async()=>{
 const old=process.env.SPACECASE_PUBLIC_URL;process.env.SPACECASE_PUBLIC_URL="https://school.example";
 let calls=0;const c={personId:randomUUID(),founder:false,schools:[{id:randomUUID(),displayName:"School"}]};
 const handler=billingHandler({context:async()=>{calls++;return c;},pool:()=>{throw new Error("must not access storage");},peos:(async()=>{throw new SupportError("ACCESS_REQUIRED");}) as typeof peosRead});
 try{
 assert.equal((await handler(new Request("https://school.example/api"))).status,401);assert.equal(calls,0);
 assert.equal((await handler(new Request("https://school.example/api",{method:"POST",headers:{origin:"https://other.example",authorization:"Bearer token"},body:"{}"}))).status,403);assert.equal(calls,0);
 assert.equal((await handler(new Request("https://school.example/api",{headers:{authorization:"Bearer token"}}))).status,403);
 assert.equal((await handler(new Request("https://school.example/api",{headers:{authorization:"Bearer token"}}),c.schools[0].id)).status,403);
 }finally{if(old===undefined)delete process.env.SPACECASE_PUBLIC_URL;else process.env.SPACECASE_PUBLIC_URL=old;}
});
