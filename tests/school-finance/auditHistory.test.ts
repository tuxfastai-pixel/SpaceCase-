import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { auditHistoryQuery, financeAuditCsv, type AuditHistoryRow } from "../../domains/school-finance/auditHistoryContracts";
import { readFinanceAuditHistory } from "../../domains/school-finance/auditHistory";
import { financeAuditHistoryGet } from "../../platform/finance/workspaceHttp";
import { FinanceAuthorizationError } from "../../platform/finance/peosAuthorization";
const schoolId=randomUUID(), accountId=randomUUID();

test("audit filters reject ambiguous, oversized and invalid boundaries; CSV neutralizes formulas", () => {
  const base={schoolId,accountId};
  for (const extra of [{start:"2026-02-30"},{start:"2026-11-02",end:"2026-11-01"},{action:"x' OR 1=1"},{resourceId:"not-uuid"},{cursor:"{}"},{cursor:"x".repeat(201)},{actorPersonId:randomUUID()}])
    assert.throws(()=>auditHistoryQuery.parse({...base,...extra}));
  const row:AuditHistoryRow={id:randomUUID(),occurredAt:"2026-11-01T12:00:00.000001Z",actorPersonId:"actor",action:"FINANCE_EXPENSE_REVIEWED",resourceType:"EXPENSE",resourceId:randomUUID(),decision:"APPROVED",reason:' =HYPERLINK("bad")'};
  const csv=financeAuditCsv([row]);
  assert.ok(csv.includes('"\' =HYPERLINK(""bad"")"'));
  assert.ok(csv.startsWith('"Event ID","UTC timestamp"'));
});

test("audit endpoint denies disabled, invalid and revoked requests before database access", async () => {
  const flag=process.env.SPACECASE_FINANCE_WORKSPACE_ENABLED, mode=process.env.SPACECASE_WORKSPACE_MODE;
  const deps={pool:()=>{throw Error("Database must not be reached");},permission:async()=>{throw new FinanceAuthorizationError(403,"FINANCE_FORBIDDEN");},learner:async()=>{throw Error("Unused");}};
  const url=`https://spacecase.example/api/finance/audit?schoolId=${schoolId}&accountId=${accountId}`;
  try {
    process.env.SPACECASE_FINANCE_WORKSPACE_ENABLED="false";
    assert.equal((await financeAuditHistoryGet(new Request(url),deps)).status,503);
    process.env.SPACECASE_FINANCE_WORKSPACE_ENABLED="true";
    process.env.SPACECASE_WORKSPACE_MODE="full";
    for(const suffix of ["&cursor={}","&start=2026-02-30","&schoolId="+randomUUID(),"&unknown=x"])
      assert.equal((await financeAuditHistoryGet(new Request(url+suffix),deps)).status,400);
    assert.equal((await financeAuditHistoryGet(new Request(url+"&format=csv"),deps)).status,403);
    const denied=await financeAuditHistoryGet(new Request(url),deps);
    assert.equal(denied.status,403);assert.equal(denied.headers.get("cache-control"),"no-store");
    process.env.SPACECASE_WORKSPACE_MODE="authority_only";
    assert.equal((await financeAuditHistoryGet(new Request(url),deps)).status,503);
  } finally {
    if(flag===undefined)delete process.env.SPACECASE_FINANCE_WORKSPACE_ENABLED;else process.env.SPACECASE_FINANCE_WORKSPACE_ENABLED=flag;
    if(mode===undefined)delete process.env.SPACECASE_WORKSPACE_MODE;else process.env.SPACECASE_WORKSPACE_MODE=mode;
  }
});

test("PostgreSQL audit history pages tied timestamps without loss and enforces school/current audit authority",{timeout:30000},async t=>{
  if(!process.env.DATABASE_URL){t.skip("Requires isolated PostgreSQL");return;}
  const pool=new Pool({connectionString:process.env.DATABASE_URL,max:4});
  const school=randomUUID(),otherSchool=randomUUID(),account=randomUUID(),otherAccount=randomUUID(),actor=randomUUID(),resource=randomUUID();
  const authorize=async(id:string,action:string)=>{assert.equal(action,"finance.audit.read");return {schoolId:id,personId:actor};};
  const input={schoolId:school,accountId:account,action:"FINANCE_EXPENSE_REVIEWED",start:"2026-11-01",end:"2026-11-01"};
  try {
    for(const id of [school,otherSchool])await pool.query("INSERT INTO school_ops.school_workspaces(peos_school_id) VALUES($1)",[id]);
    for(const [id,schoolId] of [[account,school],[otherAccount,otherSchool]])await pool.query("INSERT INTO school_finance.accounts(id,peos_school_id,status) VALUES($1,$2,'ACTIVE')",[id,schoolId]);
    await pool.query(`INSERT INTO school_finance.audit_events(account_id,actor_peos_person_id,action,resource_type,resource_id,metadata,occurred_at)
      SELECT $1,$2,'FINANCE_EXPENSE_REVIEWED','EXPENSE',$3,'{"decision":"APPROVED","reason":"Checked evidence"}'::jsonb,'2026-11-01T12:00:00.123456Z'::timestamptz FROM generate_series(1,205)`,[account,actor,resource]);
    await pool.query("INSERT INTO school_finance.audit_events(account_id,actor_peos_person_id,action,resource_type,resource_id,occurred_at) VALUES($1,$2,'FINANCE_EXPENSE_REVIEWED','EXPENSE',$3,'2026-11-01T12:00:00.123456Z')",[otherAccount,actor,resource]);
    const ids=new Set<string>();let next:string|null=null;const sizes:number[]=[];
    do {
      const page=await readFinanceAuditHistory(pool,{...input,...(next?{cursor:next}:{})},actor,authorize);
      sizes.push(page.rows.length);
      for(const row of page.rows){assert.ok(!ids.has(row.id));ids.add(row.id);assert.equal(row.reason,"Checked evidence");assert.equal(row.occurredAt,"2026-11-01T12:00:00.123456Z");}
      next=page.nextCursor;
    }while(next);
    assert.deepEqual(sizes,[100,100,5]);assert.equal(ids.size,205);
    assert.equal((await readFinanceAuditHistory(pool,{...input,resourceId:randomUUID()},actor,authorize)).rows.length,0);
    assert.equal((await readFinanceAuditHistory(pool,{...input,start:"2026-11-02",end:"2026-11-02"},actor,authorize)).rows.length,0);
    await assert.rejects(readFinanceAuditHistory(pool,{...input,schoolId:otherSchool},actor,authorize),/FINANCE_ACCOUNT_UNAVAILABLE/);
    await assert.rejects(readFinanceAuditHistory(pool,input,randomUUID(),authorize),/FINANCE_FORBIDDEN/);
    await assert.rejects(readFinanceAuditHistory(pool,input,actor,async()=>{throw new FinanceAuthorizationError(403,"FINANCE_FORBIDDEN");}),/FINANCE_FORBIDDEN/);
    const reads=await pool.query("SELECT count(*)::int n FROM school_finance.audit_events WHERE account_id=$1 AND action='FINANCE_AUDIT_HISTORY_READ'",[account]);
    assert.equal(reads.rows[0].n,5);
    const query=new URLSearchParams({...input,format:"csv"});
    const previousFlag=process.env.SPACECASE_FINANCE_WORKSPACE_ENABLED, previousMode=process.env.SPACECASE_WORKSPACE_MODE;
    let exported: Response;
    try {
      process.env.SPACECASE_FINANCE_WORKSPACE_ENABLED="true";
      process.env.SPACECASE_WORKSPACE_MODE="full";
      exported=await financeAuditHistoryGet(new Request(`https://spacecase.example/api/finance/audit?${query}`),{
        pool:()=>pool, permission:async(request, id, action)=>{void request; return {...await authorize(id,action),action};}, learner:async()=>{throw Error("Unused");},
      });
    } finally {
      if(previousFlag===undefined)delete process.env.SPACECASE_FINANCE_WORKSPACE_ENABLED;else process.env.SPACECASE_FINANCE_WORKSPACE_ENABLED=previousFlag;
      if(previousMode===undefined)delete process.env.SPACECASE_WORKSPACE_MODE;else process.env.SPACECASE_WORKSPACE_MODE=previousMode;
    }
    assert.equal(exported.status,200);
    assert.equal(exported.headers.get("cache-control"),"no-store");
    assert.match(exported.headers.get("content-type") ?? "",/text\/csv/);
    assert.equal((await exported.text()).split("\r\n").length,101);
    assert.equal((await pool.query("SELECT count(*)::int n FROM school_finance.audit_events WHERE account_id=$1 AND action='FINANCE_AUDIT_HISTORY_EXPORTED'",[account])).rows[0].n,1);
  }finally{
    for(const id of [account,otherAccount]){await pool.query("DELETE FROM school_finance.audit_events WHERE account_id=$1",[id]);await pool.query("DELETE FROM school_finance.accounts WHERE id=$1",[id]);}
    for(const id of [school,otherSchool])await pool.query("DELETE FROM school_ops.school_workspaces WHERE peos_school_id=$1",[id]);
    await pool.end();
  }
});
