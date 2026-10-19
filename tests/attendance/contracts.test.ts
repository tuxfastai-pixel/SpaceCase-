import assert from "node:assert/strict";
import test from "node:test";
import {attendanceDate,attendanceInput,assertRosterEntries,schoolDate,type AttendanceRoster} from "../../domains/attendance/contracts";
const learner="12345678-1234-4234-8234-123456789012";
const input={date:"2026-10-19",revision:0,reason:"INITIAL_REGISTER",entries:[{personId:learner,status:"PRESENT"}]};
test("attendance validates actual calendar dates, status, bounded input and correction reasons",()=>{
 assert.equal(attendanceDate.safeParse("2024-02-29").success,true);
 for(const date of ["2026-02-29","2026-13-01","19-10-2026","2026-10-19T00:00:00Z"]){assert.equal(attendanceDate.safeParse(date).success,false);}
 assert.equal(attendanceInput.safeParse(input).success,true);
 for(const bad of [{...input,revision:-1},{...input,entries:[]},{...input,entries:[...input.entries,...input.entries]},{...input,entries:[{personId:learner,status:"SICK",notes:"private"}]},{...input,revision:1},{...input,schoolId:learner}])assert.equal(attendanceInput.safeParse(bad).success,false);
 assert.equal(attendanceInput.safeParse({...input,revision:1,reason:"LATE_UPDATE"}).success,true);
});
test("the entire submitted roster must match current authorized learners",()=>{
 const roster:AttendanceRoster={class:{id:"class",name:"2C",academicYear:2026},learners:[{personId:learner,admissionNumber:"A001",givenName:"Lea",familyName:"Example"}]};
 assert.doesNotThrow(()=>assertRosterEntries(roster,attendanceInput.parse(input)));
 assert.throws(()=>assertRosterEntries({...roster,learners:[]},attendanceInput.parse(input)),/ROSTER_CHANGED/);
 assert.throws(()=>assertRosterEntries({...roster,learners:[{...roster.learners[0],personId:"another"}]},attendanceInput.parse(input)),/ROSTER_CHANGED/);
});
test("school date follows timezone around midnight rather than browser or UTC date",()=>{
 const now=new Date("2026-10-18T23:30:00Z");assert.equal(schoolDate("Africa/Johannesburg",now),"2026-10-19");assert.equal(schoolDate("America/New_York",now),"2026-10-18");
});
