import test from "node:test";
import assert from "node:assert/strict";
import { peosPreviewHeaders } from "../../platform/peos/previewHeaders";
test("PEOS deployment access credential is server configured, optional and Preview-only",()=>{
  const previousEnv=process.env.VERCEL_ENV, previousSecret=process.env.PEOS_PREVIEW_PROTECTION_BYPASS;
  try {
    process.env.PEOS_PREVIEW_PROTECTION_BYPASS="synthetic-preview-access";
    for(const environment of ["production","development"]){process.env.VERCEL_ENV=environment;assert.deepEqual(peosPreviewHeaders("synthetic-oidc"),{});}
    process.env.VERCEL_ENV="preview";
    assert.deepEqual(peosPreviewHeaders("synthetic-oidc"),{"x-vercel-trusted-oidc-idp-token":"synthetic-oidc","x-vercel-protection-bypass":"synthetic-preview-access"});
    assert.deepEqual(peosPreviewHeaders(null),{"x-vercel-protection-bypass":"synthetic-preview-access"});
    delete process.env.PEOS_PREVIEW_PROTECTION_BYPASS;
    assert.deepEqual(peosPreviewHeaders(null),{});
  } finally {
    if(previousEnv===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=previousEnv;
    if(previousSecret===undefined)delete process.env.PEOS_PREVIEW_PROTECTION_BYPASS;else process.env.PEOS_PREVIEW_PROTECTION_BYPASS=previousSecret;
  }
});

test("school directory preserves user authentication across protected Preview transport", async()=>{
  const {adminSchools}=await import('../../platform/admin/peosProxy');
  const prior={...process.env};
  try{
    process.env.PEOS_BASE_URL='https://peos.example.test';
    process.env.PEOS_PREVIEW_PROTECTION_BYPASS='synthetic-preview-access';
    for(const environment of ['preview','production','development']){
      process.env.VERCEL_ENV=environment;
      const result=await adminSchools('Bearer synthetic-user',async(input,init)=>{
        assert.equal(String(input),'https://peos.example.test/v1/admin/schools');
        const h=new Headers(init?.headers);
        assert.equal(h.get('authorization'),'Bearer synthetic-user');
        assert.equal(h.get('x-vercel-protection-bypass'),environment==='preview'?'synthetic-preview-access':null);
        return Response.json({schools:[]});
      });
      assert.deepEqual(result,[]);
    }
    process.env.VERCEL_ENV='preview';
    await assert.rejects(()=>adminSchools('Bearer synthetic-user',async()=>new Response('Denied',{status:403})),/WORKSPACE_AUTHORITY_UNAVAILABLE/);
  }finally{for(const key of ['PEOS_BASE_URL','PEOS_PREVIEW_PROTECTION_BYPASS','VERCEL_ENV']){if(prior[key]===undefined)delete process.env[key];else process.env[key]=prior[key];}}
});
