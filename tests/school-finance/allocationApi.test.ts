import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../../app/api/finance/allocations/route";

const endpoint="https://spacecase.example/api/finance/allocations";
const request=(body:unknown,origin="https://spacecase.example")=>new Request(endpoint,{
  method:"POST",headers:{"content-type":"application/json",origin},
  body:JSON.stringify(body),
});
const valid={
  schoolId:"00000000-0000-4000-8000-000000000001",
  accountId:"00000000-0000-4000-8000-000000000002",
  paymentId:"00000000-0000-4000-8000-000000000003",
  invoiceId:"00000000-0000-4000-8000-000000000004",
  amountMinor:"100",
};
test("finance allocation API is disabled by default",async()=>{
  const old=process.env.SPACECASE_FINANCE_ALLOCATION_API_ENABLED;
  delete process.env.SPACECASE_FINANCE_ALLOCATION_API_ENABLED;
  try{
    const response=await POST(request(valid));
    assert.equal(response.status,503);
    assert.equal((await response.json()).error,"FINANCE_NOT_ENABLED");
  }finally{
    if(old===undefined)delete process.env.SPACECASE_FINANCE_ALLOCATION_API_ENABLED;
    else process.env.SPACECASE_FINANCE_ALLOCATION_API_ENABLED=old;
  }
});
test("enabled allocation API rejects cross-origin requests before any financial access",async()=>{
  const old=process.env.SPACECASE_FINANCE_ALLOCATION_API_ENABLED;
  process.env.SPACECASE_FINANCE_ALLOCATION_API_ENABLED="true";
  try{
    const response=await POST(request(valid,"https://attacker.example"));
    assert.equal(response.status,403);
  }finally{
    if(old===undefined)delete process.env.SPACECASE_FINANCE_ALLOCATION_API_ENABLED;
    else process.env.SPACECASE_FINANCE_ALLOCATION_API_ENABLED=old;
  }
});
test("enabled allocation API validates payload before financial access",async()=>{
  const old=process.env.SPACECASE_FINANCE_ALLOCATION_API_ENABLED;
  process.env.SPACECASE_FINANCE_ALLOCATION_API_ENABLED="true";
  try{
    for(const body of [{...valid,amountMinor:"1.5"},{...valid,schoolId:"invalid"},{...valid,unexpected:true}]){
      const response=await POST(request(body));
      assert.equal(response.status,400);
    }
  }finally{
    if(old===undefined)delete process.env.SPACECASE_FINANCE_ALLOCATION_API_ENABLED;
    else process.env.SPACECASE_FINANCE_ALLOCATION_API_ENABLED=old;
  }
});
