import {csvCells,IntakeError} from './intakeCsvCells';
export {csvCells,IntakeError} from './intakeCsvCells';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {financeDate} from './workspaceContracts';
import {minorUnits} from './money';
export const intakeMapping=z.object({date:z.string().min(1).max(100),reference:z.string().min(1).max(100),amount:z.string().min(1).max(100),transactionId:z.string().min(1).max(100).optional()}).strict().refine(m=>new Set(Object.values(m)).size===Object.values(m).length,'Choose separate columns');
export const intakeUpload=z.object({source:z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9][a-zA-Z0-9 _-]*$/),csv:z.string().min(1).max(262144),delimiter:z.enum([',',';','\t']),decimalSeparator:z.enum(['.',',']),mapping:intakeMapping}).strict();
export type IntakeUpload=z.infer<typeof intakeUpload>;
export type IntakeRow={line:number;date:string;reference:string;transactionId:string|null;amountMinor:string;fingerprint:string};
export const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function normalizeIntake(raw:IntakeUpload){
 const input=intakeUpload.parse(raw),cells=csvCells(input.csv,input.delimiter),headers=cells[0].map(v=>v.trim());
 if(headers.some(v=>!v||v.length>100)||new Set(headers).size!==headers.length)throw new IntakeError('UNIQUE_HEADERS_REQUIRED');
 const indices=Object.fromEntries(Object.entries(input.mapping).map(([key,value])=>{const index=headers.indexOf(value);if(index<0)throw new IntakeError('MAPPING_HEADER_MISSING');return [key,index];})) as Record<string,number>;
 const rows:IntakeRow[]=[],errors:{line:number;message:string}[]=[];let ignored=0;
 cells.slice(1).forEach((cells,i)=>{
  const line=i+2;
  try{
   if(cells.length!==headers.length)throw new IntakeError('Column count does not match header');
   const rawAmount=cells[indices.amount].trim(),separator=input.decimalSeparator;
   const pattern=separator==='.'?/^-?(0|[1-9][0-9]*)(\.[0-9]{1,2})?$/:/^-?(0|[1-9][0-9]*)(,[0-9]{1,2})?$/;
   if(!pattern.test(rawAmount))throw new IntakeError('Use signed rand and cents without currency symbols or thousands separators');
   const [whole,fraction='']=rawAmount.replace('-','').split(separator),amount=minorUnits((BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'))).toString());
   if(rawAmount.startsWith('-')||amount===0n){ignored++;return;}
   const date=cells[indices.date].trim().replaceAll('/','-');if(!financeDate.safeParse(date).success)throw new IntakeError('Use a valid YYYY-MM-DD date');
   const reference=cells[indices.reference].trim(),transactionId=indices.transactionId===undefined?null:cells[indices.transactionId].trim()||null;
   if(!reference||reference.length>200||/[\u0000-\u001f\u007f]/.test(reference))throw new IntakeError('Payment reference is required (up to 200 characters, single line)');
   if(transactionId&&(transactionId.length>120||/[\u0000-\u001f\u007f]/.test(transactionId)))throw new IntakeError('Invalid transaction ID');
   rows.push({line,date,reference,transactionId,amountMinor:amount.toString(),fingerprint:hash([date,reference.toUpperCase(),amount.toString()])});
  }catch(error){errors.push({line,message:error instanceof IntakeError?error.message:'Invalid row value'});}
 });
 const source=input.source.toLowerCase().replace(/\s+/g,' ');
 const digest=hash({source,rows:rows.map(row=>({date:row.date,reference:row.reference,transactionId:row.transactionId,amountMinor:row.amountMinor,fingerprint:row.fingerprint})),ignored});
 return {source,headers,headerSignature:hash(headers),rows,errors,ignored,received:cells.length-1,digest};
}
