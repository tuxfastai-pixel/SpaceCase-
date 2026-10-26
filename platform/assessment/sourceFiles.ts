import {inflateRawSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {AssessmentError} from '../../domains/assessment/contracts';
import {SOURCE_BYTES,type SourceFormat} from '../../domains/assessment/sourceContracts';
import {normalizePhoto} from './storage';
/** Read only bounded DOCX XML; never extract paths, execute macros, resolve entities or fetch links. */
function docxXml(bytes:Buffer){
 const end=bytes.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));if(end<0||end+22>bytes.length)throw Error('zip');
 const entries=bytes.readUInt16LE(end+10),size=bytes.readUInt32LE(end+12),start=bytes.readUInt32LE(end+16);
 if(bytes.readUInt16LE(end+4)||bytes.readUInt16LE(end+6)||entries>1000||entries===65535||start+size!==end||end+22+bytes.readUInt16LE(end+20)!==bytes.length)throw Error('zip bounds');
 let offset=start,total=0,xml:Buffer|undefined,types=false;const names=new Set<string>();
 for(let i=0;i<entries;i++){
  if(offset+46>end||bytes.readUInt32LE(offset)!==0x02014b50)throw Error('directory');
  const flags=bytes.readUInt16LE(offset+8),method=bytes.readUInt16LE(offset+10),packed=bytes.readUInt32LE(offset+20),unpacked=bytes.readUInt32LE(offset+24),nl=bytes.readUInt16LE(offset+28),extra=bytes.readUInt16LE(offset+30),comment=bytes.readUInt16LE(offset+32),local=bytes.readUInt32LE(offset+42);
  const next=offset+46+nl+extra+comment;if(next>end||flags&1||![0,8].includes(method)||unpacked>8000000||packed>bytes.length)throw Error('entry');total+=unpacked;if(total>16000000)throw Error('expanded size');
  const name=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(offset+46,offset+46+nl));if(names.has(name)||name.includes('..')||name.startsWith('/')||name.includes('\\')||/vbaProject|embeddings\//i.test(name))throw Error('unsupported entry');names.add(name);if(name==='[Content_Types].xml')types=true;
  if(local+30>start||bytes.readUInt32LE(local)!==0x04034b50||bytes.readUInt16LE(local+8)!==method||bytes.readUInt16LE(local+6)!==flags)throw Error('local header');
  const localName=bytes.readUInt16LE(local+26),localExtra=bytes.readUInt16LE(local+28),body=local+30+localName+localExtra;
  if(body+packed>start||!bytes.subarray(local+30,local+30+localName).equals(Buffer.from(name)))throw Error('local bounds');
  if(name==='word/document.xml'){
   if(unpacked>1000000)throw Error('document limit');xml=method===0?bytes.subarray(body,body+packed):inflateRawSync(bytes.subarray(body,body+packed),{maxOutputLength:1000000});if(xml.length!==unpacked)throw Error('size');
  }
  offset=next;
 }
 if(offset!==end||!types||!xml)throw Error('not docx');
 const text=new TextDecoder('utf-8',{fatal:true}).decode(xml);if(/<!DOCTYPE|<!ENTITY/i.test(text)||!/<w:document\b/.test(text))throw Error('xml');return text;
}
export function extractDocxText(bytes:Buffer){
 try{const xml=docxXml(bytes);const text=xml.replace(/<w:(?:tab)\b[^>]*\/?\s*>/g,'\t').replace(/<w:(?:br|cr)\b[^>]*\/?\s*>/g,'\n').replace(/<\/w:p\s*>/g,'\n').replace(/<[^>]*>/g,'').replace(/&(amp|lt|gt|quot|apos);/g,(_,name:string)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"})[name]!).trim();if(text.length>40000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text))throw Error('text limit');return text;}catch{throw new AssessmentError('INVALID_SOURCE_DOCUMENT',400);}
}
export async function validateSource(bytes:Buffer,format:SourceFormat){
 if(!bytes.length||bytes.length>SOURCE_BYTES)throw new AssessmentError('SOURCE_TOO_LARGE',400);
 let clean=bytes;
 if(format==='JPEG')clean=(await normalizePhoto(bytes)).bytes;
 else if(format==='PDF'){if(!bytes.subarray(0,5).equals(Buffer.from('%PDF-'))||!bytes.subarray(Math.max(0,bytes.length-1024)).includes(Buffer.from('%%EOF')))throw new AssessmentError('INVALID_SOURCE_DOCUMENT',400);}
 else if(format==='DOCX'){try{docxXml(bytes);}catch{throw new AssessmentError('INVALID_SOURCE_DOCUMENT',400);}}
 else if(!bytes.subarray(0,8).equals(Buffer.from([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1])))throw new AssessmentError('INVALID_SOURCE_DOCUMENT',400);
 return {bytes:clean,hash:createHash('sha256').update(clean).digest('hex')};
}
