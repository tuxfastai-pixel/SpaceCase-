import assert from "node:assert/strict";
import test from "node:test";
import {randomUUID} from "node:crypto";
import {supportHandler,founderHandler} from "../../platform/support/http";
import {peosRead,contextSchema} from "../../platform/support/authority";
import type {SupportContext} from "../../domains/support/contracts";
const schoolId=randomUUID();const c:SupportContext={personId:randomUUID(),founder:false,schools:[{id:schoolId,displayName:"School"}]};
function req(method="GET",body?:unknown,origin="https://school.example",signed=true){return new Request("https://school.example/api/support",{method,headers:{origin,...(signed?{authorization:"Bearer scoped"}:{})},...(method==="GET"?{}:{body:JSON.stringify(body)})});}
test("support and founder endpoints reject cross-site, unsigned and wrong-role requests before storage",async()=>{
 const old=process.env.SPACECASE_PUBLIC_URL;process.env.SPACECASE_PUBLIC_URL="https://school.example";let calls=0;
 const deps={context:async()=>{calls++;return c;},pool:()=>{throw new Error("storage must not be called");},peos:peosRead};
 try{
 const support=supportHandler(deps),founder=founderHandler(deps);
 assert.equal((await support(req("POST",{},"https://other.example"))).status,403);assert.equal(calls,0);
 assert.equal((await support(req("GET",undefined,undefined,false))).status,401);assert.equal(calls,0);
 assert.equal((await founder(req())).status,403);
 assert.equal((await support(new Request("https://school.example/api/support?schoolId="+randomUUID(),{headers:{authorization:"Bearer scoped"}}))).status,403);
 const input={requestId:randomUUID(),schoolId:randomUUID(),category:"BUG",impact:"BLOCKED",area:"OTHER",title:"CI issue",description:"A bounded reproduction description."};
 assert.equal((await support(req("POST",input))).status,403);
 const empty=supportHandler({...deps,context:async()=>({...c,schools:[]})});
 const response=await empty(req());assert.equal(response.status,200);assert.equal(response.headers.get("cache-control"),"no-store");assert.deepEqual((await response.json()).tickets,[]);
 }finally{if(old===undefined)delete process.env.SPACECASE_PUBLIC_URL;else process.env.SPACECASE_PUBLIC_URL=old;}
});
test("PEOS errors and malformed authority are dependency failures, not validation messages",async()=>{
 const old=process.env.PEOS_BASE_URL;process.env.PEOS_BASE_URL="https://peos.example";
 try{
 for(const response of [new Response("{bad"),Response.json({personId:randomUUID(),founder:true}),Response.json({error:"unavailable"},{status:500})]){
 await assert.rejects(peosRead(req(),"/context",contextSchema,(async()=>response) as typeof fetch),/PEOS_UNAVAILABLE/);
 }
 }finally{if(old===undefined)delete process.env.PEOS_BASE_URL;else process.env.PEOS_BASE_URL=old;}
});
