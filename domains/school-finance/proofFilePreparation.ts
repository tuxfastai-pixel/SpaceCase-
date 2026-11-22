import sharp from 'sharp';
import {z} from 'zod';
import {createHash} from 'node:crypto';
import {PaymentProofError,quarantineFingerprint,type proofMime,MAX_PROOF_BYTES} from './proofContracts';
import type {ProofScanner,ProofScan} from '../../platform/evidence/clamav';
const verdict=z.object({hash:z.string().regex(/^[a-f0-9]{64}$/),verdict:z.enum(['CLEAN','INFECTED']),engine:z.string().min(1).max(80).regex(/^[a-zA-Z0-9._+-]+$/),definitions:z.string().min(1).max(80).regex(/^[a-zA-Z0-9._+-]+$/),checkedAt:z.string().datetime()}).strict();
async function checkedScan(scanner:ProofScanner,bytes:Buffer){const result=verdict.parse(await scanner.scan(Buffer.from(bytes))),hash=createHash('sha256').update(bytes).digest('hex'),at=Date.parse(result.checkedAt);if(result.hash!==hash||at>Date.now()+5000||at<Date.now()-60000)throw new PaymentProofError('PROOF_SCAN_MISMATCH');if(result.verdict!=='CLEAN')throw new PaymentProofError('PROOF_FILE_BLOCKED');return result;}
export type PreparedProofFile={body:Buffer;mimeType:'image/jpeg'|'application/pdf';sourceHash:string;fileHash:string;scans:ProofScan[]};
/** Inject only a trusted server scanner; no request can supply a verdict or choose an engine. */
export async function prepareProofFile(source:Buffer,mimeType:z.infer<typeof proofMime>,scanner:ProofScanner):Promise<PreparedProofFile>{
 const original=quarantineFingerprint(source,mimeType),first=await checkedScan(scanner,original.bytes);
 if(mimeType==='application/pdf')return {body:original.bytes,mimeType,sourceHash:original.hash,fileHash:original.hash,scans:[first]};
 let body:Buffer;
 try{const image=sharp(original.bytes,{limitInputPixels:16000000,animated:false,failOn:'warning'}),metadata=await image.metadata();if(!['jpeg','png'].includes(metadata.format??'')||(metadata.pages??1)!==1||!metadata.width||!metadata.height)throw Error();body=await image.rotate().flatten({background:'white'}).jpeg({quality:90}).toBuffer();if(!body.length||body.length>MAX_PROOF_BYTES)throw Error();}catch{throw new PaymentProofError('PROOF_IMAGE_INVALID');}
 const second=await checkedScan(scanner,body);return {body,mimeType:'image/jpeg',sourceHash:original.hash,fileHash:second.hash,scans:[first,second]};
}
