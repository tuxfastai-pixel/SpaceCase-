import test from 'node:test';
import assert from 'node:assert/strict';
import {csvCells,normalizeIntake,intakeUpload} from '../../domains/school-finance/intakeCsv';
const base={source:'Test Bank',delimiter:',' as const,decimalSeparator:'.' as const,mapping:{date:'Date',reference:'Reference',amount:'Amount',transactionId:'ID'},csv:'Date,Reference,Amount,ID\r\n2025-11-01,FEE-1,100.01,T1'};
test('intake parses exact cents, BOM, quoted delimiters and ignores debits explicitly',()=>{
 const result=normalizeIntake({...base,csv:'\uFEFFDate,Reference,Amount,ID\r\n2025/11/01,"FEE, ""one""",100.01,T1\r\n2025-11-02,Debit,-2.50,T2\r\n2025-11-03,Zero,0,T3'});
 assert.equal(result.rows[0].amountMinor,'10001');assert.equal(result.rows[0].reference,'FEE, "one"');assert.equal(result.ignored,2);assert.equal(result.errors.length,0);
 const equivalent=normalizeIntake({...base,source:'test bank',csv:base.csv.replace('100.01','100.01')});
 assert.equal(equivalent.digest,normalizeIntake(base).digest);
});
test('mapping is explicit, locale is explicit and invalid dates/amounts block rows',()=>{
 assert.equal(normalizeIntake({...base,csv:'Date;Reference;Amount;ID\n2025-11-01;FEE-1;125,50;T1',delimiter:';',decimalSeparator:','}).rows[0].amountMinor,'12550');
 for(const csv of ['2025-02-30,FEE-1,1.00,T1','13/11/2025,FEE-1,1.00,T1','2025-11-01,FEE-1,R100,T1','2025-11-01,FEE-1,1.001,T1'])assert.equal(normalizeIntake({...base,csv:'Date,Reference,Amount,ID\n'+csv}).errors.length,1);
 assert.throws(()=>normalizeIntake({...base,mapping:{...base.mapping,date:'Missing'}}),/MAPPING_HEADER_MISSING/);
 assert.equal(intakeUpload.safeParse({...base,mapping:{date:'Date',reference:'Date',amount:'Amount'}}).success,false);
});
test('CSV rejects malformed quoting, duplicated headers, oversized files and excessive rows',()=>{
 assert.throws(()=>csvCells('a,b\n"unfinished',','),/MALFORMED_CSV/);
 assert.throws(()=>csvCells('a,b\n"closed"junk,x',','),/MALFORMED_CSV/);
 assert.throws(()=>csvCells('a\n'+('x\n'.repeat(501)),','),/TOO_MANY_ROWS/);
 assert.throws(()=>normalizeIntake({...base,csv:'Date,Date,Amount,ID\n2025-11-01,x,1,T1'}),/UNIQUE_HEADERS/);
 assert.throws(()=>csvCells('a\n'+'x'.repeat(262145),','),/FILE_TOO_LARGE/);
 assert.deepEqual(csvCells('a,b\n"line\none",two',','),[['a','b'],['line\none','two']]);
});
