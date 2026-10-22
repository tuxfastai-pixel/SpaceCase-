import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {observationFields,observationInput,observationQuery} from "../../domains/observations/contracts";
const recordId=randomUUID(),learnerId=randomUUID();
const fields={kind:"POSITIVE",observedDate:"2026-10-22",context:"Group reading",evidence:"Read three sentences aloud",response:"Acknowledged effort",nextStep:"",followUpDate:null};
test("observations require bounded factual input, calendar dates and ordered follow-up",()=>{
 assert.equal(observationFields.safeParse(fields).success,true);
 for(const v of [{...fields,evidence:"  "},{...fields,observedDate:"2026-02-30"},{...fields,followUpDate:"2026-10-21"},{...fields,evidence:"x".repeat(3001)},{...fields,context:"\u0000"},{...fields,kind:"DIAGNOSIS"}])assert.equal(observationFields.safeParse(v).success,false);
});
test("observation mutations reject injected ownership, learner reassignment and missing reasons",()=>{
 assert.equal(observationInput.safeParse({action:"CREATE",recordId,learnerId,fields}).success,true);
 for(const v of [{action:"CREATE",recordId,learnerId,fields,teacherId:randomUUID()},{action:"EDIT",recordId,revision:1,fields},{action:"EDIT",recordId,revision:1,fields,reason:"ENTRY_CORRECTION",learnerId},{action:"RESOLVE",recordId,revision:1,outcome:" "},{action:"REOPEN",recordId,revision:0,reason:"FOLLOW_UP"},{action:"RETRACT",recordId,revision:1,reason:"OTHER"}])assert.equal(observationInput.safeParse(v).success,false);
});
test("observation filters bound page size and reject unsupported fields",()=>{
 assert.deepEqual(observationQuery.parse({state:"OPEN"}),{state:"OPEN",offset:0});
 for(const v of [{offset:-1},{offset:10001},{state:"ARCHIVED"},{teacherId:randomUUID()}])assert.equal(observationQuery.safeParse(v).success,false);
});
