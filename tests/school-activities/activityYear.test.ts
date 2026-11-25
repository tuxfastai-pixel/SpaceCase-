import test from 'node:test';
import assert from 'node:assert/strict';
import {activityYearChoices,resolveActivityYear} from '../../app/finance/activityYear';
import {samplePolicy} from './fixtures';
const calendar=(id:string,year=2027,version=1)=>({id,year,version,policy:{...samplePolicy,label:`${year} activity year`}});
test('an absent activity year has no selectable value and a sole saved year is selected automatically',()=>{
 assert.equal(resolveActivityYear('',[]),'');assert.deepEqual(activityYearChoices([]),[]);assert.equal(resolveActivityYear('',[calendar('only')]),'only');
});
test('new activities see the latest settings per year; more than one year requires an explicit choice',()=>{
 const rows=[calendar('old',2027,1),calendar('latest',2027,2)];assert.equal(resolveActivityYear('',rows),'latest');assert.deepEqual(activityYearChoices(rows).map(c=>c.id),['latest']);const multiple=[...rows,calendar('next',2028)];assert.equal(resolveActivityYear('',multiple),'');assert.deepEqual(activityYearChoices(multiple).map(c=>c.id),['next','latest']);
});
test('refresh and calendar revision never silently move an existing draft to newer settings',()=>{
 const rows=[calendar('old',2027,1),calendar('latest',2027,2)];assert.equal(resolveActivityYear('old',rows),'old');assert.deepEqual(activityYearChoices(rows,'old').map(c=>c.id),['latest','old']);
});
test('a disappeared selection must be checked instead of automatically attaching the draft to a different year',()=>{
 const rows=[calendar('another',2028)];assert.equal(resolveActivityYear('missing',rows),'missing');assert.equal(resolveActivityYear('missing',[]),'missing');
});
