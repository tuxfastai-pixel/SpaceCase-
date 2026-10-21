import assert from "node:assert/strict";
import test from "node:test";
import {randomUUID} from "node:crypto";
import {operationsHandler} from "../../platform/operations/http";
import type {SupportContext} from "../../domains/support/contracts";
test("observer metadata endpoints deny unsigned, expired scope and cross-school requests before storage",async()=>{
 const c:SupportContext={personId:randomUUID(),founder:false,schools:[],observerSchools:[{id:randomUUID(),displayName:"Scoped school"}]};
 const noPool=()=>{throw new Error("Storage should not be called");};const req=(suffix="",method="GET",signed=true)=>new Request("https://school.example/api/operations"+suffix,{method,headers:signed?{authorization:"Bearer token"}:{}});
 const handler=operationsHandler({context:async()=>c,pool:noPool});
 assert.equal((await handler(req("","GET",false))).status,401);assert.equal((await handler(req("","POST"))).status,405);
 assert.equal((await handler(req("?schoolId="+randomUUID()))).status,403);
 assert.equal((await operationsHandler({context:async()=>({...c,observerSchools:[]}),pool:noPool})(req())).status,403);
 assert.equal((await operationsHandler({context:async()=>({...c,founder:true,observerSchools:[]}),pool:noPool})(req())).status,403);
});
