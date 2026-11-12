import test from "node:test";
import assert from "node:assert/strict";
import {googleSignInEnabled} from "../../platform/auth/googleSignInAvailability";
import {POST} from "../../app/auth/google/route";
test("paused Google sign-in denies before provider calls and does not affect default deployments",async()=>{
  assert.equal(googleSignInEnabled({}),true);
  assert.equal(googleSignInEnabled({SPACECASE_GOOGLE_SIGNIN_ENABLED:"true"}),true);
  assert.equal(googleSignInEnabled({SPACECASE_GOOGLE_SIGNIN_ENABLED:"false"}),false);
  const previous=process.env.SPACECASE_GOOGLE_SIGNIN_ENABLED;
  try{
    process.env.SPACECASE_GOOGLE_SIGNIN_ENABLED="false";
    const response=await POST(new Request("https://spacecase.example/auth/google",{method:"POST"}));
    assert.equal(response.status,503);assert.equal(response.headers.get("cache-control"),"no-store");
    assert.equal(response.headers.has("location"),false);
  }finally{
    if(previous===undefined)delete process.env.SPACECASE_GOOGLE_SIGNIN_ENABLED;else process.env.SPACECASE_GOOGLE_SIGNIN_ENABLED=previous;
  }
});
