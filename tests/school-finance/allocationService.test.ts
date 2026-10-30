import test from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import { allocateVerifiedSchoolPayment } from "../../domains/school-finance/allocationService";

const input = {
  accountId:"account",schoolId:"school",paymentId:"payment",invoiceId:"invoice",
  amountMinor:"100",actorPersonId:"person",
};
test("allocation rejects zero and malformed money before database access",async()=>{
  const pool = {connect:()=>{throw Error("DATABASE_MUST_NOT_BE_USED");}} as unknown as Pool;
  const authorize=async()=>({schoolId:input.schoolId,personId:input.actorPersonId});
  for(const amountMinor of ["0","-1","1.5","1e3","9223372036854775808"]){
    await assert.rejects(allocateVerifiedSchoolPayment(pool,{...input,amountMinor},authorize));
  }
});
test("allocation denies mismatched PEOS school or actor before database access",async()=>{
  const pool = {connect:()=>{throw Error("DATABASE_MUST_NOT_BE_USED");}} as unknown as Pool;
  await assert.rejects(
    allocateVerifiedSchoolPayment(pool,input,async()=>({schoolId:"other-school",personId:input.actorPersonId})),
    /FINANCE_FORBIDDEN/,
  );
  await assert.rejects(
    allocateVerifiedSchoolPayment(pool,input,async()=>({schoolId:input.schoolId,personId:"other-person"})),
    /FINANCE_FORBIDDEN/,
  );
});
test("allocation propagates unavailable PEOS authority without database access",async()=>{
  const pool = {connect:()=>{throw Error("DATABASE_MUST_NOT_BE_USED");}} as unknown as Pool;
  await assert.rejects(
    allocateVerifiedSchoolPayment(pool,input,async()=>{throw Error("PEOS_UNAVAILABLE");}),
    /PEOS_UNAVAILABLE/,
  );
});
