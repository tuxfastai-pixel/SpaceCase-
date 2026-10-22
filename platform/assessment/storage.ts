import {put,get} from "@vercel/blob";
import sharp from "sharp";
import {createHash} from "node:crypto";
import {AssessmentError} from "../../domains/assessment/contracts";
export type PhotoQuality={width:number;height:number;warnings:Array<"LOW_RESOLUTION"|"LOW_CONTRAST">;method:"pixel_heuristics_v1"};
export type NormalizedPhoto={bytes:Buffer;hash:string;quality?:PhotoQuality};
export async function photoQuality(bytes:Buffer):Promise<PhotoQuality>{
 const photo=sharp(bytes,{limitInputPixels:24000000});const [meta,stats]=await Promise.all([photo.metadata(),photo.stats()]);
 const warnings:PhotoQuality["warnings"]=[];
 if(Math.min(meta.width??0,meta.height??0)<700)warnings.push("LOW_RESOLUTION");
 if(Math.max(...stats.channels.slice(0,3).map(c=>c.stdev))<12)warnings.push("LOW_CONTRAST");
 return {width:meta.width??0,height:meta.height??0,warnings,method:"pixel_heuristics_v1"};
}
export async function normalizePhoto(bytes:Buffer):Promise<NormalizedPhoto>{
 if(!bytes.length||bytes.length>2097152)throw new AssessmentError("PHOTO_TOO_LARGE",400);
 const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const webp=bytes.subarray(0,4).toString()==="RIFF"&&bytes.subarray(8,12).toString()==="WEBP";
 if(!jpeg&&!png&&!webp)throw new AssessmentError("INVALID_PHOTO",400);
 try{
  const image=sharp(bytes,{limitInputPixels:24000000,animated:false,failOn:"warning"});const meta=await image.metadata();
  if((meta.pages??1)>1||!meta.width||!meta.height||meta.width<100||meta.height<100)throw new Error("invalid dimensions");
  const cleaned=await image.rotate().resize({width:1800,height:2400,fit:"inside",withoutEnlargement:true}).flatten({background:"white"}).jpeg({quality:85}).toBuffer();
  if(cleaned.length>2097152)throw new AssessmentError("PHOTO_TOO_LARGE",400);
  return {bytes:cleaned,hash:createHash("sha256").update(cleaned).digest("hex"),quality:await photoQuality(cleaned)};
 }catch(e){if(e instanceof AssessmentError)throw e;throw new AssessmentError("INVALID_PHOTO",400);}
}
export interface PhotoStore{put(key:string,bytes:Buffer):Promise<void>;get(key:string):Promise<Buffer>;}
export function photoStore():PhotoStore{
 if(!storageConfigured())throw new AssessmentError("STORAGE_NOT_CONFIGURED",503);
 return {
  async put(key,bytes){await put(key,bytes,{access:"private",contentType:"image/jpeg",addRandomSuffix:false,allowOverwrite:true,abortSignal:AbortSignal.timeout(20000)});},
  async get(key){
   const r=await get(key,{access:"private",abortSignal:AbortSignal.timeout(20000)});
   if(!r||r.statusCode!==200||r.blob.size>2097152)throw new AssessmentError("PHOTO_UNAVAILABLE",503);
   const reader=r.stream.getReader();const chunks:Uint8Array[]=[];let size=0;
   try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2097152){await reader.cancel();throw new AssessmentError("PHOTO_UNAVAILABLE",503);}chunks.push(value);}}finally{reader.releaseLock();}
   return Buffer.concat(chunks);
  },
 };
}
export function storageConfigured(){return Boolean(process.env.BLOB_READ_WRITE_TOKEN||(process.env.BLOB_STORE_ID&&process.env.VERCEL_OIDC_TOKEN));}
