import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {homeworkInput,taskFields} from "../../domains/homework/contracts";
const taskId=randomUUID();
const fields={title:"Read chapter 2",subject:"Literacy",instructions:"Read and answer questions 1–3",assignedDate:"2026-10-22",dueDate:"2026-10-23"};
test("homework rejects invalid dates, reversed due dates, empty text and injected identity",()=>{
 assert.equal(taskFields.safeParse(fields).success,true);
 for(const f of [{...fields,dueDate:"2026-02-30"},{...fields,dueDate:"2026-10-21"},{...fields,title:"  "},{...fields,instructions:"\u0000"}])assert.equal(taskFields.safeParse(f).success,false);
 assert.equal(homeworkInput.safeParse({action:"CREATE",taskId,fields,teacherId:randomUUID()}).success,false);
});
test("completion contract rejects duplicate learners, invalid status and unbounded revisions",()=>{
 const entry={personId:randomUUID(),status:"COMPLETED"};const input={action:"COMPLETIONS",taskId,revision:1,reason:"CORRECTION",entries:[entry]};
 assert.equal(homeworkInput.safeParse(input).success,true);
 for(const v of [{...input,entries:[entry,entry]},{...input,entries:[{...entry,status:"PASSED"}]},{...input,revision:0},{...input,revision:2147483647}])assert.equal(homeworkInput.safeParse(v).success,false);
});
