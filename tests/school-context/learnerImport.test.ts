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
