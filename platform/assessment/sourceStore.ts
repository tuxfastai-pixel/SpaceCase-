import {put,get} from '@vercel/blob';
import {AssessmentError} from '../../domains/assessment/contracts';
import {SOURCE_BYTES} from '../../domains/assessment/sourceContracts';
import {storageConfigured} from './storage';
export interface SourceStore{put(key:string,bytes:Buffer):Promise<void>;get(key:string):Promise<Buffer>}
export function sourceStore():SourceStore{
 if(!storageConfigured())throw new AssessmentError('STORAGE_NOT_CONFIGURED',503);
 return {async put(key,bytes){await put(key,bytes,{access:'private',contentType:'application/octet-stream',addRandomSuffix:false,allowOverwrite:true,abortSignal:AbortSignal.timeout(20000)});},async get(key){const r=await get(key,{access:'private',abortSignal:AbortSignal.timeout(20000)});if(!r||r.statusCode!==200||r.blob.size>SOURCE_BYTES)throw new AssessmentError('SOURCE_UNAVAILABLE',503);const reader=r.stream.getReader(),chunks:Uint8Array[]=[];let length=0;try{for(;;){const p=await reader.read();if(p.done)break;length+=p.value.byteLength;if(length>SOURCE_BYTES){await reader.cancel();throw new AssessmentError('SOURCE_TOO_LARGE',400);}chunks.push(p.value);}}finally{reader.releaseLock();}return Buffer.concat(chunks);}};
}
