import test from "node:test";
import assert from "node:assert/strict";
import {teacherDaySchema} from "../../domains/teacher-day/contracts";
export const emptyDay={date:"2026-10-23",timezone:"Africa/Johannesburg",className:"Grade 2C",attendance:{saved:false,rosterCount:0,marked:0,unmarked:0,present:0,absent:0,late:0,excused:0},lessons:{total:0,items:[]},homework:{overdue:0,dueToday:0,upcoming:0,items:[]},assessments:{awaitingReview:0,unmatchedPhotos:0},followUps:{overdue:0,dueToday:0}};
test("daily projection accepts real empty states and rejects learner detail, narrative and impossible counters",()=>{
 assert.equal(teacherDaySchema.safeParse(emptyDay).success,true);
 for(const value of [{...emptyDay,learners:[{name:"Private name"}]},{...emptyDay,followUps:{...emptyDay.followUps,evidence:"Private observation"}},{...emptyDay,attendance:{...emptyDay.attendance,absent:-1}},{...emptyDay,attendance:{...emptyDay.attendance,marked:1}},{...emptyDay,assessments:{awaitingReview:1.5,unmatchedPhotos:0}}])assert.equal(teacherDaySchema.safeParse(value).success,false);
});
