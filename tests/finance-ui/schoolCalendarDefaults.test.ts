import {test} from 'node:test';import assert from 'node:assert/strict';
import {schoolCalendarDefault} from '../../app/finance/schoolCalendarDefaults';
import {calendarPolicy} from '../../domains/school-activities/registerContracts';
test('verified learner calendars validate and half-year groups contain every term',()=>{for(const year of [2026,2027])assert.equal(calendarPolicy.safeParse(schoolCalendarDefault(year)).success,true);assert.equal(schoolCalendarDefault(2028),null);});
test('2027 uses published final terms, not conflicting proposed dates; edits stay independent',()=>{const p=schoolCalendarDefault(2027)!;assert.deepEqual(p.terms[2],{start:'2027-07-20',end:'2027-09-22'});assert.deepEqual(p.terms[3],{start:'2027-10-05',end:'2027-12-08'});p.terms[0].start='2027-01-01';assert.equal(schoolCalendarDefault(2027)!.terms[0].start,'2027-01-13');});
