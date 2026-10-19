import assert from "node:assert/strict";
import test from "node:test";
import {learnerSchema,parseLearnerCsv,reviewLearners} from "../../platform/learners/import";
test("learner CSV handles quoted names, Unicode, BOM and school-reference normalization",()=>{
 const rows=parseLearnerCsv('\uFEFFfamily_name,admission_number,given_name\r\n"Dlamini, Junior",0001,"Léa"\r\nExample,ab-2,"Sam"');
 assert.deepEqual(rows,[{familyName:"Dlamini, Junior",admissionNumber:"0001",givenName:"Léa",selected:true},{familyName:"Example",admissionNumber:"AB-2",givenName:"Sam",selected:true}]);
});
test("duplicate references, missing names and unsafe references are excluded for review",()=>{
 const rows=parseLearnerCsv('admission_number,given_name,family_name\na001,Lea,Example\nA001,Sam,Example\nA002,,Example\n=FORMULA,Lea,Example');
 assert.deepEqual(rows.map(r=>r.selected),[true,false,false,false]);
 assert.equal(reviewLearners(rows)[1].issue,"Duplicate learner reference");
 assert.equal(learnerSchema.safeParse({admissionNumber:"A001",givenName:"Lea",familyName:"Example",personId:"guessed"}).success,false);
});
test("learner CSV rejects extra personal fields, malformed rows, and oversize imports",()=>{
 for(const source of ['admission_number,given_name,family_name,date_of_birth\nA,Lea,Example,2016-01-01','admission_number,given_name,family_name\nA,Lea','admission_number,given_name,family_name','admission_number,given_name,family_name\nA,"Lea,Example'])assert.throws(()=>parseLearnerCsv(source));
 assert.throws(()=>parseLearnerCsv('admission_number,given_name,family_name\n'+Array.from({length:51},(_,i)=>`A${i},Lea,Example`).join('\n')),/50/);
 assert.throws(()=>parseLearnerCsv('é'.repeat(33000)),/64 KB/);
});
test("reference validation explains spaces and generated references pass the enrolment contract",async()=>{
 const {generateLearnerReference,learnerValidationMessage}=await import("../../platform/learners/import");
 const names={givenName:"Kabelo",familyName:"Senyane"};
 assert.match(learnerValidationMessage({...names,admissionNumber:"SCP student 1234"})!,/Spaces are not allowed/);
 const refs=Array.from({length:100},generateLearnerReference);
 assert.equal(new Set(refs).size,100);
 for(const admissionNumber of refs){assert.ok(admissionNumber.length<=40);assert.equal(learnerSchema.safeParse({...names,admissionNumber}).success,true);}
 assert.match(learnerValidationMessage({...names,admissionNumber:"SCP-1234",familyName:""})!,/family name \/ surname/);
 assert.equal(learnerValidationMessage({...names,admissionNumber:"SCP-1234"}),null);
});
test("school reference default fills only missing CSV references and preserves supplied or invalid references",()=>{
 const csv='admission_number,given_name,family_name\n,Lea,Example\n  ,Sam,Example\n0001,Kabelo,Senyane\nBad ref,Tumi,Example';
 const manual=parseLearnerCsv(csv);assert.deepEqual(manual.map(r=>r.selected),[false,false,true,false]);
 const automatic=parseLearnerCsv(csv,true);assert.deepEqual(automatic.map(r=>r.selected),[true,true,true,false]);
 assert.match(automatic[0].admissionNumber,/^SC-/);assert.notEqual(automatic[0].admissionNumber,automatic[1].admissionNumber);
 assert.equal(automatic[2].admissionNumber,"0001");assert.equal(automatic[3].admissionNumber,"Bad ref");
 assert.deepEqual(reviewLearners(automatic).map(row=>row.admissionNumber),automatic.map(row=>row.admissionNumber));
});
