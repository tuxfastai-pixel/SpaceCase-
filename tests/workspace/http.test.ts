import assert from "node:assert/strict";
import test from "node:test";
import {workspaceRequest} from "../../platform/admin/workspaceHttp";
test("workspace configuration rejects cross-origin and unsigned requests before storage access",async()=>{
 const old=process.env.SPACECASE_PUBLIC_URL;process.env.SPACECASE_PUBLIC_URL="https://school.example";
 try{
  const body=JSON.stringify({timezone:"UTC",academicYearLabel:"2026"});
  const cross=await workspaceRequest(new Request("https://school.example/api/workspace",{method:"POST",headers:{origin:"https://other.example"},body}),"12345678-1234-4234-8234-123456789012");
  assert.equal(cross.status,403);
  const unsigned=await workspaceRequest(new Request("https://school.example/api/workspace",{method:"POST",headers:{origin:"https://school.example"},body}),"12345678-1234-4234-8234-123456789012");
  assert.equal(unsigned.status,401);assert.equal(unsigned.headers.get("cache-control"),"no-store");
 }finally{if(old===undefined)delete process.env.SPACECASE_PUBLIC_URL;else process.env.SPACECASE_PUBLIC_URL=old;}
});

test("a signed-in account without current school authority cannot configure product storage",async()=>{
 const oldUrl=process.env.SPACECASE_PUBLIC_URL,oldPeos=process.env.PEOS_BASE_URL;const realFetch=globalThis.fetch;
 process.env.SPACECASE_PUBLIC_URL="https://school.example";process.env.PEOS_BASE_URL="https://peos.example";const urls:string[]=[];
 globalThis.fetch=(async(url:URL|RequestInfo)=>{
  urls.push(String(url));
  if(String(url).endsWith("/v1/sessions/introspect"))return Response.json({session:{sessionId:"session",personId:"person",issuedAt:"2026-10-19T00:00:00Z",expiresAt:"2026-10-20T00:00:00Z"}});
  return Response.json({error:"SCHOOL_ADMIN_REQUIRED"},{status:403});
 }) as typeof fetch;
 try{
  const result=await workspaceRequest(new Request("https://school.example/api/workspace",{method:"POST",headers:{origin:"https://school.example",authorization:"Bearer test-session"},body:JSON.stringify({timezone:"UTC",academicYearLabel:"2026"})}),"12345678-1234-4234-8234-123456789012");
  assert.equal(result.status,403);assert.equal(urls.length,2);assert.ok(urls[1].includes("/v1/admin/schools/12345678-1234-4234-8234-123456789012/classes"));
 }finally{
  globalThis.fetch=realFetch;
  if(oldUrl===undefined)delete process.env.SPACECASE_PUBLIC_URL;else process.env.SPACECASE_PUBLIC_URL=oldUrl;
  if(oldPeos===undefined)delete process.env.PEOS_BASE_URL;else process.env.PEOS_BASE_URL=oldPeos;
 }
});
