import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { requireSchoolFinancePermission, requireFinanceLearner, FinanceAuthorizationError } from "../../platform/finance/peosAuthorization";

test("Finance preview calls carry separate deployment and user identities only to configured PEOS",async()=>{
  const previousUrl=process.env.PEOS_BASE_URL, previousEnv=process.env.VERCEL_ENV;
  const schoolId=randomUUID(),personId=randomUUID(),learnerId=randomUUID();
  const request=new Request("https://spacecase.example/api/finance/workspace", {headers:{
    cookie:"peos_session=synthetic-user-session", "x-vercel-oidc-token":"synthetic-deployment-identity",
    "x-vercel-trusted-oidc-idp-token":"untrusted-incoming-bypass",
  }});
  try {
    process.env.PEOS_BASE_URL="https://isolated-peos.example";
    for(const environment of ["preview","production","development"]) {
      process.env.VERCEL_ENV=environment;
      const transport=(async(url: string | URL | Request, init?:RequestInit)=>{
        const target=new URL(String(url)),headers=new Headers(init?.headers);
        assert.equal(target.origin,"https://isolated-peos.example");
        assert.equal(headers.get("authorization"),"Bearer synthetic-user-session");
        assert.equal(headers.get("x-vercel-trusted-oidc-idp-token"),environment==="preview"?"synthetic-deployment-identity":null);
        assert.equal(headers.get("x-vercel-oidc-token"),null);
        assert.equal(init?.cache,"no-store");
        if(target.pathname.endsWith("/authorize")){
          assert.equal(init?.method,"POST");assert.deepEqual(JSON.parse(String(init?.body)),{action:"finance.expenditure.approve"});
          return Response.json({allowed:true,schoolId,personId,action:"finance.expenditure.approve"});
        }
        assert.equal(target.searchParams.get("reference"),"SYNTHETIC-1");
        return Response.json({personId:learnerId,admissionNumber:"SYNTHETIC-1",givenName:"Synthetic",familyName:"Learner"});
      }) as typeof fetch;
      assert.equal((await requireSchoolFinancePermission(request,schoolId,"finance.expenditure.approve",transport)).personId,personId);
      assert.equal((await requireFinanceLearner(request,schoolId,"SYNTHETIC-1",transport)).personId,learnerId);
    }
    process.env.VERCEL_ENV="preview";
    for(const data of [
      {allowed:true,schoolId:randomUUID(),personId,action:"finance.expenditure.approve"},
      {allowed:true,schoolId,personId,action:"finance.transactions.record"},
      {allowed:false,schoolId,personId,action:"finance.expenditure.approve"},
    ])await assert.rejects(requireSchoolFinancePermission(request,schoolId,"finance.expenditure.approve",(async()=>Response.json(data)) as typeof fetch),
      (error:unknown)=>error instanceof FinanceAuthorizationError&&error.status===403);
    await assert.rejects(requireSchoolFinancePermission(request,schoolId,"finance.expenditure.approve",(async()=>new Response("Protected deployment login",{status:401})) as typeof fetch),
      (error:unknown)=>error instanceof FinanceAuthorizationError&&error.status===401);
    const noPlatformToken=new Request(request.url,{headers:{authorization:"Bearer synthetic-user-session","x-vercel-trusted-oidc-idp-token":"untrusted"}});
    await requireSchoolFinancePermission(noPlatformToken,schoolId,"finance.expenditure.approve",(async(_url,init)=>{
      assert.equal(new Headers(init?.headers).get("x-vercel-trusted-oidc-idp-token"),null);
      return Response.json({allowed:true,schoolId,personId,action:"finance.expenditure.approve"});
    }) as typeof fetch);
  } finally {
    if(previousUrl===undefined)delete process.env.PEOS_BASE_URL;else process.env.PEOS_BASE_URL=previousUrl;
    if(previousEnv===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=previousEnv;
  }
});
