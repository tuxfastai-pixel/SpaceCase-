import {createHash} from 'node:crypto';
import {z} from 'zod';
import {financeDate} from './workspaceContracts';
import {minorUnits} from './money';
export class PaymentProofError extends Error {constructor(public code:string){super(code);}}
export const proofMime=z.enum(['image/jpeg','image/png','application/pdf']);
export const proofClaim=z.object({amountMinor:z.string().refine(v=>{try{return minorUnits(v)>0n;}catch{return false;}}),paidOn:financeDate,reference:z.string().trim().min(1).max(160).regex(/^[^\u0000-\u001f\u007f]+$/),method:z.enum(['EFT','CASH_DEPOSIT','OTHER'])}).strict();
export const proofSubmission=z.object({requestId:z.string().uuid().toLowerCase(),claim:proofClaim,mimeType:proofMime}).strict();
// Trusted server configuration only. No browser-selected retention or quota.
export const proofQuarantinePolicy=z.object({version:z.string().min(1).max(80).regex(/^[a-zA-Z0-9._-]+$/),hours:z.number().int().min(1).max(72),requestsPerPersonDay:z.number().int().min(1).max(20),accountBytesPerDay:z.number().int().min(2097152).max(104857600)}).strict();
export type ProofSubmission=z.infer<typeof proofSubmission>;
export type ProofQuarantinePolicy=z.infer<typeof proofQuarantinePolicy>;
export const MAX_PROOF_BYTES=2097152;
export function quarantineFingerprint(source:Buffer,mimeType:z.infer<typeof proofMime>){
 const bytes=Buffer.from(source);
 if(!bytes.length||bytes.length>MAX_PROOF_BYTES)throw new PaymentProofError('PROOF_FILE_SIZE');
 const type=proofMime.parse(mimeType);
 const recognized=type==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):type==='image/jpeg'?bytes.subarray(0,3).equals(Buffer.from([255,216,255]))&&bytes.subarray(-2).equals(Buffer.from([255,217])):/^%PDF-(1\.[0-7]|2\.0)/.test(bytes.subarray(0,8).toString('latin1'))&&/%%EOF\s*$/.test(bytes.subarray(-1024).toString('latin1'));
 if(!recognized)throw new PaymentProofError('PROOF_FILE_TYPE');
 // A matching signature is not a malware scan, valid document or proof of payment.
 return {bytes,hash:createHash('sha256').update(bytes).digest('hex'),size:bytes.length};
}
