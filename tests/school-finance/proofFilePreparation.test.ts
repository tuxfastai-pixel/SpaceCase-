import test from 'node:test';import assert from 'node:assert/strict';import sharp from 'sharp';import {createHash} from 'node:crypto';
import {prepareProofFile} from '../../domains/school-finance/proofFilePreparation';import {privateProofResponse} from '../../domains/school-finance/paymentProofFiles';import type {ProofScanner} from '../../platform/evidence/clamav';
const clean:ProofScanner={scan:async bytes=>({hash:createHash('sha256').update(bytes).digest('hex'),verdict:'CLEAN',engine:'synthetic-only',definitions:'test-v1',checkedAt:new Date().toISOString()})};
test('raster proof is normalized without metadata and both original and derived bytes are scanned',async()=>{
 const source=await sharp({create:{width:50,height:60,channels:3,background:'blue'}}).png().withMetadata().toBuffer();const seen:Buffer[]=[];const prepared=await prepareProofFile(source,'image/png',{scan:async bytes=>{seen.push(Buffer.from(bytes));return clean.scan(bytes);}});
 assert.equal(seen.length,2);assert.deepEqual(seen[0],source);assert.deepEqual(seen[1],prepared.body);assert.equal(prepared.mimeType,'image/jpeg');assert.equal(prepared.scans.length,2);assert.equal((await sharp(prepared.body).metadata()).exif,undefined);
});
test('scanner mismatch, detection, timeout and invalid raster cannot create a cleared file',async()=>{
 const pdf=Buffer.from('%PDF-1.7\nSYNTHETIC\n%%EOF');
 for(const scanner of [{scan:async(bytes:Buffer)=>({...await clean.scan(bytes),hash:'0'.repeat(64)})},{scan:async(bytes:Buffer)=>({...await clean.scan(bytes),verdict:'INFECTED' as const})},{scan:async()=>{throw Error('scanner timeout');}}])await assert.rejects(prepareProofFile(pdf,'application/pdf',scanner));
 await assert.rejects(prepareProofFile(Buffer.from([137,80,78,71,13,10,26,10]),'image/png',clean),/PROOF_IMAGE_INVALID/);
});
test('cleared PDFs are attachments with no-store/nosniff/sandbox and expire before response',async()=>{
 const pdf=Buffer.from('%PDF-1.7\nSYNTHETIC\n%%EOF'),prepared=await prepareProofFile(pdf,'application/pdf',clean);assert.deepEqual(prepared.body,pdf);assert.equal(prepared.scans.length,1);
 const file={id:'79d4e523-cb85-4fba-b650-41a6a1854016',body:prepared.body,mimeType:prepared.mimeType,expiresAt:new Date(Date.now()+60000).toISOString()},response=privateProofResponse(file);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.ok(response.headers.get('content-disposition')?.startsWith('attachment;'));assert.ok(response.headers.get('content-security-policy')?.includes('sandbox'));assert.deepEqual(Buffer.from(await response.arrayBuffer()),pdf);
 assert.throws(()=>privateProofResponse({...file,expiresAt:new Date(0).toISOString()}),/PROOF_FILE_UNAVAILABLE/);assert.throws(()=>privateProofResponse({...file,expiresAt:'unknown'}),/PROOF_FILE_UNAVAILABLE/);
});
