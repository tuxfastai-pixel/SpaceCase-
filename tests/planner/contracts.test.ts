import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {planInput,monday,currentWeek} from "../../domains/planner/contracts";
const lesson={id:randomUUID(),date:"2026-10-21",subject:"Maths",topic:"Addition",objectives:"",activities:"",resources:"",reflection:"",status:"DRAFT"};
test("weekly planner validates dates, unique lessons, states and readiness",()=>{
 const base={week:"2026-10-19",revision:0,lessons:[lesson]};
 assert.equal(planInput.safeParse(base).success,true);
 for(const v of [{...base,week:"2026-10-20"},{...base,lessons:[{...lesson,date:"2026-10-26"}]},{...base,lessons:[lesson,lesson]},{...base,lessons:[{...lesson,status:"READY"}]},{...base,lessons:[{...lesson,status:"TAUGHT"}]},{...base,lessons:[{...lesson,learnerName:"not supported"}]},{...base,lessons:Array.from({length:51},()=>({...lesson,id:randomUUID()}))}])assert.equal(planInput.safeParse(v).success,false);
 assert.equal(planInput.safeParse({...base,lessons:[{...lesson,status:"READY",objectives:"Add two numbers",activities:"Count objects"}]}).success,true);
 assert.equal(planInput.safeParse({...base,lessons:[]}).success,true);
});
test("school week uses Monday consistently across Sundays and year boundaries",()=>{
 assert.equal(monday("2026-10-25"),"2026-10-19");assert.equal(monday("2027-01-01"),"2026-12-28");assert.match(currentWeek("Africa/Johannesburg"),/^\d{4}-\d{2}-\d{2}$/);
});
