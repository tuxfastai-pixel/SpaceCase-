import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {caseworkHandler} from "../../platform/casework/http";
import {peosRead} from "../../platform/support/authority";
import type {SupportContext} from "../../domains/support/contracts";
test("casework denies observers, wrong roles, unsigned and cross-origin requests before storage",async()=>{
 const old=process.env.SPACECASE_PUBLIC_URL;process.env.SPACECASE_PUBLIC_URL="https://school.example";let calls=0;
 const c:SupportContext={personId:randomUUID(),founder:false,schools:[],observerSchools:[{id:randomUUID(),displayName:"School"}],agentSchools:[]};
 const deps={context:async()=>{calls++;return c;},pool:()=>{throw new Error("must not touch storage");},peos:peosRead};
 const request=(method="GET",signed=true,origin="https://school.example",body="{}")=>new Request("https://school.example/api/casework",{method,headers:{origin,...(signed?{authorization:"Bearer test"}:{})},...(method==="GET"?{}:{body})});
 try{
 assert.equal((await caseworkHandler(false,deps)(request("GET",false))).status,401);assert.equal(calls,0);
 assert.equal((await caseworkHandler(false,deps)(request("POST",true,"https://wrong.example"))).status,403);assert.equal(calls,0);
 assert.equal((await caseworkHandler(false,deps)(request())).status,403);
 assert.equal((await caseworkHandler(true,deps)(request())).status,403);
 const agent={...deps,context:async()=>({...c,agentSchools:c.observerSchools})};assert.equal((await caseworkHandler(false,agent)(request("POST",true,undefined,"{bad"))).status,400);
 }finally{if(old===undefined)delete process.env.SPACECASE_PUBLIC_URL;else process.env.SPACECASE_PUBLIC_URL=old;}
});
