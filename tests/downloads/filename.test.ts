import test from 'node:test';
import assert from 'node:assert/strict';
import {csvDownloadName} from '../../platform/downloads/filename';
const exportedAt=new Date('2026-11-13T18:40:25.123Z');
test('CSV names identify topic, school, selected period and bounded audit page',()=>{
  assert.equal(csvDownloadName({topic:'Financial Audit History',school:'Synthetic Finance School A',start:'2025-12-01',end:'2025-12-31',page:2,exportedAt}),
    'spacecase_financial-audit-history_synthetic-finance-school-a_2025-12-01-to-2025-12-31_page-2_20261113T184025Z.csv');
  assert.match(csvDownloadName({topic:'School Fee Records',school:'School A',exportedAt}),/^spacecase_school-fee-records_school-a_/);
});
test('filenames cannot contain paths, header characters or unbounded school text',()=>{
  const name=csvDownloadName({topic:'../Finance\r\n"',school:'École / \\ Test'.repeat(30),start:'bad/date',page:-1,exportedAt});
  assert.match(name,/^spacecase_finance_ecole-test/);
  assert.doesNotMatch(name,/[\r\n"/\\]/);
  assert.ok(name.length<220);
  assert.ok(!name.includes('bad')&&!name.includes('page-'));
});
