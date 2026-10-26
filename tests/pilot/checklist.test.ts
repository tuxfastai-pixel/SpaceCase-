import test from 'node:test';import assert from 'node:assert/strict';
import {pilotChecks,pilotSummary,pilotReport,pilotIssueTitle} from '../../domains/pilot/checklist';
test('pilot observations count only recognized check IDs and verdicts, never assume untouched checks passed',()=>{
 assert.equal(new Set(pilotChecks.map(c=>c.id)).size,pilotChecks.length);const empty=pilotSummary({});assert.equal(empty.passed,0);assert.equal(empty.notChecked,pilotChecks.length);
 const summary=pilotSummary({'ADMIN-01':'PASSED','TEACH-01':'BLOCKED','TEACH-02':'APPROVED','forged':'PASSED'});assert.equal(summary.passed,1);assert.equal(summary.blocked,1);assert.equal(summary.notChecked,pilotChecks.length-2);
});
test('export whitelists check metadata and cannot grant approval or carry submitted school/learner fields',()=>{
 const report=pilotReport({'ADMIN-01':'PASSED',school:'private school',email:'private@example.test',medicalInformation:'private note'},'f'.repeat(40),'2026-10-26T00:00:00.000Z');const text=JSON.stringify(report);for(const s of ['private school','private@example.test','private note','medicalInformation'])assert.equal(text.includes(s),false);assert.equal(report.grantsLaunchApproval,false);assert.equal(report.kind,'SELF_REPORTED_PILOT_CHECKLIST');assert.equal(pilotReport({},'not-a-commit','time').releaseCommit,null);
});

test('pilot issue titles accept only known catalog IDs, never arbitrary URL text',()=>{
 assert.ok(pilotIssueTitle('TEACH-06').startsWith('Pilot TEACH-06:'));for(const value of [undefined,['TEACH-06'],'private child name','TEACH-06<script>'])assert.equal(pilotIssueTitle(value),'');
});
