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
