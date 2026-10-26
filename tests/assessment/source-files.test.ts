import test from 'node:test';import assert from 'node:assert/strict';import sharp from 'sharp';
import {wordDocument,scanPdf} from '../../app/assessments/sourceExports';
import {extractDocxText,validateSource} from '../../platform/assessment/sourceFiles';
import {sourceTextInput} from '../../domains/assessment/sourceContracts';
test('reviewed Word export round-trips Unicode and literal markup without executable XML',async()=>{
 const bytes=Buffer.from(wordDocument('Question paper','1. 2 + 2 = ?\nSymbols: < > & " ä Ω\nDo not invent an answer.'));
 const text=extractDocxText(bytes);assert.match(text,/Question paper/);assert.match(text,/Symbols: < > & " ä Ω/);assert.match(text,/Do not invent an answer/);assert.equal((await validateSource(bytes,'DOCX')).bytes.length,bytes.length);
 assert.throws(()=>wordDocument('test','bad\u0000'));assert.throws(()=>wordDocument('test','a'.repeat(40001)));
});
test('Word sources reject truncated, encrypted, oversized expansion and non-DOCX zip',async()=>{
 const valid=Buffer.from(wordDocument('Memo','Expected answer: 4'));
 for(const bad of [valid.subarray(0,40),Buffer.from('not a document')])await assert.rejects(validateSource(bad,'DOCX'),/INVALID_SOURCE_DOCUMENT/);
 const encrypted=Buffer.from(valid);encrypted.writeUInt16LE(0x801,6);await assert.rejects(validateSource(encrypted,'DOCX'),/INVALID_SOURCE_DOCUMENT/);
 const bomb=Buffer.from(valid),central=bomb.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));bomb.writeUInt32LE(20000000,central+24);await assert.rejects(validateSource(bomb,'DOCX'),/INVALID_SOURCE_DOCUMENT/);
 await assert.rejects(validateSource(Buffer.alloc(3145729),'PDF'),/SOURCE_TOO_LARGE/);
 await assert.rejects(validateSource(Buffer.from('<script>not pdf</script>'),'PDF'),/INVALID_SOURCE_DOCUMENT/);
});
test('scan PDF embeds bounded JPEG pages with valid offsets and no OCR claims',async()=>{
 const jpeg=await sharp({create:{width:300,height:400,channels:3,background:'white'}}).jpeg().toBuffer();const pdf=Buffer.from(scanPdf([{bytes:jpeg,width:300,height:400}]));
 assert.equal(pdf.subarray(0,8).toString(),'%PDF-1.4');assert.match(pdf.toString('latin1'),/\/Filter \/DCTDecode/);assert.equal(pdf.includes(Buffer.from(jpeg)),true);
 const xref=Number(pdf.toString('latin1').match(/startxref\n(\d+)/)![1]);assert.equal(pdf.subarray(xref,xref+4).toString(),'xref');await validateSource(pdf,'PDF');
 assert.throws(()=>scanPdf([]));assert.throws(()=>scanPdf([{bytes:new Uint8Array([1,2]),width:300,height:400}]));
});
test('source text is bounded and review is explicit',()=>{
 assert.equal(sourceTextInput.safeParse({revision:1,text:'Checked',reviewed:true}).success,true);
 assert.equal(sourceTextInput.safeParse({revision:1,text:'Checked',reviewed:true,marks:100}).success,false);
 assert.equal(sourceTextInput.safeParse({revision:1,text:'x'.repeat(40001),reviewed:false}).success,false);
});
