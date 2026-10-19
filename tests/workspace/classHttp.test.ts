import assert from "node:assert/strict";
import test from "node:test";
import {createSchoolClass} from "../../platform/admin/classHttp";
test("class creation denies unsigned and cross-origin callers and never invents success",async()=>{
 const old=process.env.SPACECASE_PUBLIC_URL;process.env.SPACECASE_PUBLIC_URL="https://school.example";
 try{
  const request=(origin:string)=>new Request("https://school.example/api/classes",{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify({name:"Grade 2C",academicYear:2026})});
  assert.equal((await createSchoolClass(request("https://other.example"),"school")).status,403);
  assert.equal((await createSchoolClass(request("https://school.example"),"school")).status,401);
 }finally{if(old===undefined)delete process.env.SPACECASE_PUBLIC_URL;else process.env.SPACECASE_PUBLIC_URL=old;}
});
test("a real PEOS class success remains successful when learning storage is unavailable",async()=>{
 const oldUrl=process.env.SPACECASE_PUBLIC_URL,oldPeos=process.env.PEOS_BASE_URL;const realFetch=globalThis.fetch;
 process.env.SPACECASE_PUBLIC_URL="https://school.example";process.env.PEOS_BASE_URL="https://peos.example";
 const classroom={id:"12345678-1234-4234-8234-123456789012",name:"Grade 2C",academicYear:2026};
 globalThis.fetch=(async(url:URL|RequestInfo)=>String(url).endsWith("/classes")?Response.json({class:classroom},{status:201}):Response.json({error:"UNAUTHENTICATED"},{status:401})) as typeof fetch;
 try{
  const response=await createSchoolClass(new Request("https://school.example/api/classes",{method:"POST",headers:{origin:"https://school.example",authorization:"Bearer test"},body:JSON.stringify({name:"Grade 2C",academicYear:2026})}),"12345678-1234-4234-8234-123456789012");
  assert.equal(response.status,201);assert.deepEqual(await response.json(),{class:classroom,workspaceConnected:false});assert.equal(response.headers.get("cache-control"),"no-store");
 }finally{globalThis.fetch=realFetch;if(oldUrl===undefined)delete process.env.SPACECASE_PUBLIC_URL;else process.env.SPACECASE_PUBLIC_URL=oldUrl;if(oldPeos===undefined)delete process.env.PEOS_BASE_URL;else process.env.PEOS_BASE_URL=oldPeos;}
});
