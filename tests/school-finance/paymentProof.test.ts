import test from 'node:test';
import assert from 'node:assert/strict';
import {proofSubmission,proofQuarantinePolicy,quarantineFingerprint,MAX_PROOF_BYTES} from '../../domains/school-finance/proofContracts';
const png=Buffer.from([137,80,78,71,13,10,26,10,0]);
test('quarantine accepts only bounded supported signatures and copies the incoming buffer',()=>{
 const original=Buffer.from(png),file=quarantineFingerprint(original,'image/png');original[0]=0;assert.equal(file.bytes[0],137);assert.equal(file.hash.length,64);
 assert.throws(()=>quarantineFingerprint(png,'image/jpeg'),/PROOF_FILE_TYPE/);
 assert.throws(()=>quarantineFingerprint(Buffer.from('<html>bank proof</html>'),'application/pdf'),/PROOF_FILE_TYPE/);
 assert.throws(()=>quarantineFingerprint(Buffer.alloc(0),'image/png'),/PROOF_FILE_SIZE/);
 assert.throws(()=>quarantineFingerprint(Buffer.alloc(MAX_PROOF_BYTES+1),'image/png'),/PROOF_FILE_SIZE/);
 const pdf=Buffer.from('%PDF-1.7\nnot scanned\n%%EOF\n');assert.deepEqual(quarantineFingerprint(pdf,'application/pdf').bytes,pdf);
});
test('proof claims exclude verification, account selectors, file URLs and impossible dates',()=>{
 const valid={requestId:'170f0f62-ddb4-4a38-b7dc-0d780a4cbb53',claim:{amountMinor:'35000',paidOn:'2026-11-22',reference:'SYNTHETIC-PROOF',method:'EFT'},mimeType:'image/png'};
 assert.equal(proofSubmission.parse(valid).claim.amountMinor,'35000');
 for(const extra of [{verified:true},{learnerId:'other'},{fileUrl:'https://example.com/proof'}])assert.equal(proofSubmission.safeParse({...valid,...extra}).success,false);
 for(const claim of [{...valid.claim,amountMinor:'0'},{...valid.claim,amountMinor:'9223372036854775808'},{...valid.claim,paidOn:'2026-02-30'},{...valid.claim,reference:'bad\nreference'}])assert.equal(proofSubmission.safeParse({...valid,claim}).success,false);
});
test('quarantine requires a bounded explicit server policy, with no implicit retention default',()=>{
 assert.equal(proofQuarantinePolicy.safeParse({}).success,false);
 const policy={version:'synthetic-v1',hours:24,requestsPerPersonDay:10,accountBytesPerDay:2097152};assert.deepEqual(proofQuarantinePolicy.parse(policy),policy);
 for(const invalid of [{...policy,hours:73},{...policy,requestsPerPersonDay:100},{...policy,accountBytesPerDay:1},{...policy,fileRetentionForever:true}])assert.equal(proofQuarantinePolicy.safeParse(invalid).success,false);
});
