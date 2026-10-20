import assert from "node:assert/strict";
import {test} from "node:test";
import {schoolSetupSignals} from "../../domains/support/setupDiagnostics";
test("workspace setup gaps remain distinct from class connections",()=>{
 const result=schoolSetupSignals({workspace:null,classes:[{id:"a",assignedTeachers:0}],connectedClassIds:[],classesTruncated:false});
 assert.deepEqual(result.map(s=>s.code),["WORKSPACE","TEACHERS"]);
});
test("connections must match displayed classes and eligible teachers",()=>{
 const result=schoolSetupSignals({workspace:{status:"ACTIVE"},classes:[{id:"a",assignedTeachers:1},{id:"b",assignedTeachers:0}],connectedClassIds:["a","unrelated"],classesTruncated:false});
 assert.deepEqual(result.map(s=>s.code),["TEACHERS","CONNECTIONS"]);
 assert.match(result[1].detail,/^1 displayed/);
});
test("complete displayed setup produces no gaps, truncated data stays qualified",()=>{
 const input={workspace:{status:"ACTIVE"},classes:[{id:"a",assignedTeachers:1}],connectedClassIds:["a"],classesTruncated:false};
 assert.deepEqual(schoolSetupSignals(input),[]);
 assert.deepEqual(schoolSetupSignals({...input,classesTruncated:true}).map(s=>s.code),["PARTIAL"]);
});
test("empty school gives an actionable class setup signal",()=>{
 assert.deepEqual(schoolSetupSignals({workspace:{status:"ACTIVE"},classes:[],connectedClassIds:[],classesTruncated:false}).map(s=>s.code),["CLASSES"]);
});
