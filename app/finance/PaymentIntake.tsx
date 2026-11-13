"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {z} from 'zod';
import {csvCells} from '../../domains/school-finance/intakeCsvCells';
import {formatZar} from './forms';
import s from './finance.module.css';
const suggestion=z.object({invoiceNumber:z.string(),outstandingMinor:z.string(),amountFits:z.boolean()}).nullable();
const item=z.object({id:z.string(),source:z.string(),date:z.string(),reference:z.string(),transactionId:z.string().nullable(),amountMinor:z.string(),status:z.enum(['READY','DUPLICATE_REVIEW','REPORTED','DISMISSED']),duplicateKind:z.string().nullable(),paymentId:z.string().nullable(),reviewReason:z.string().nullable(),suggestion});
const mappingSchema=z.object({date:z.string(),reference:z.string(),amount:z.string(),transactionId:z.string().optional()});
const queueSchema=z.object({rows:z.array(item),profiles:z.array(z.object({source:z.string(),mapping:mappingSchema,delimiter:z.enum([',',';','\t']),decimalSeparator:z.enum(['.',',']),headerSignature:z.string()})),counts:z.array(z.object({status:z.string(),count:z.number()})),nextCursor:z.string().nullable()});
const previewSchema=z.object({received:z.number(),ignored:z.number(),errors:z.array(z.object({line:z.number(),message:z.string()})),previewDigest:z.string(),items:z.array(z.object({line:z.number(),date:z.string(),reference:z.string(),amountMinor:z.string(),status:z.string(),duplicateKind:z.string().nullable(),suggestion}))});
type Mapping=z.infer<typeof mappingSchema>;
const messages:Record<string,string>={PREVIEW_CHANGED_REVIEW_AGAIN:'The records changed. Preview this file again before importing.',VALID_CREDIT_ROWS_REQUIRED:'Correct the invalid rows and preview again. At least one positive incoming payment is required.',SOURCE_TRANSACTION_ID_MUST_BE_UNIQUE:'That transaction ID is already present. Correct the source or dismiss this duplicate; it cannot be treated as a different transaction.',PAYMENT_INTAKE_NOT_ENABLED:'Payment intake is not activated in this environment.',REVIEW_DUPLICATE_OR_DISMISSED_ITEM:'Resolve the duplicate before preparing a payment.',ITEM_ALREADY_PROCESSED:'This item has already been processed. Refresh the queue.'};
async function read(response:Response){const body=await response.json();if(!response.ok)throw Error(messages[body.error]??'The request could not be completed. Check your access and refresh before trying again.');return body;}
export default function PaymentIntake({schoolId,accountId,canRecord,enabled,onReported}:{schoolId:string;accountId:string;canRecord:boolean;enabled:boolean;onReported:()=>void}){
 const [data,setData]=useState<z.infer<typeof queueSchema>|null>(null),[csv,setCsv]=useState(''),[headers,setHeaders]=useState<string[]>([]),[source,setSource]=useState(''),[delimiter,setDelimiter]=useState<','|';'|'\t'>(','),[decimal,setDecimal]=useState<'.'|','>('.'),[mapping,setMapping]=useState<Mapping>({date:'',reference:'',amount:''}),[preview,setPreview]=useState<z.infer<typeof previewSchema>|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0),[before,setBefore]=useState<string|null>(null),[previous,setPrevious]=useState<(string|null)[]>([]);
 const pending=useRef(false),post=useRef<AbortController|null>(null);
 useEffect(()=>()=>post.current?.abort(),[]);
 useEffect(()=>{setPreview(null);if(!csv){setHeaders([]);return;}try{const h=csvCells(csv,delimiter)[0].map(v=>v.trim());setHeaders(h);setError('');}catch{setHeaders([]);setError('The CSV could not be read. Check the separator, quoting and file size.');}},[csv,delimiter]);
 useEffect(()=>{
  if(!enabled)return;
  const controller=new AbortController();setData(null);
  const params=new URLSearchParams({schoolId,accountId});if(before)params.set('before',before);
  void fetch(`/api/finance/intake?${params}`,{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])}).then(read).then(body=>{if(!controller.signal.aborted)setData(queueSchema.parse(body));}).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Queue unavailable');});
  return ()=>controller.abort();
 },[schoolId,accountId,before,refresh,enabled]);
 async function send(command:Record<string,unknown>){
  if(pending.current)return;pending.current=true;setBusy(true);setError('');setNotice('');
  const controller=new AbortController();post.current=controller;
  try{
   const body=await read(await fetch('/api/finance/intake',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({schoolId,accountId,...command}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(30000)])}));
   if(controller.signal.aborted)return;
   if(command.command==='PREVIEW')setPreview(previewSchema.parse(body));
   else {setPreview(null);setNotice(command.command==='IMPORT'?(body.replayed?'This statement was already imported. No items were duplicated.':`${body.imported} incoming items saved for review.`):command.command==='REPORT'?'Payment reported. Independent verification is still required.':'Review decision saved.');setRefresh(v=>v+1);if(command.command==='REPORT')onReported();}
  }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Request unavailable');}
  finally{pending.current=false;if(!controller.signal.aborted)setBusy(false);}
 }
 function upload(){return {source,csv,delimiter,decimalSeparator:decimal,mapping:Object.fromEntries(Object.entries(mapping).filter(([,v])=>v))};}
 async function chooseFile(file:File|undefined){setPreview(null);setError('');if(!file)return;if(file.size>262144){setError('Choose a CSV smaller than 256 KiB.');return;}setCsv(await file.text());}
 function review(event:FormEvent<HTMLFormElement>,row:z.infer<typeof item>){event.preventDefault();const form=new FormData(event.currentTarget);void send({command:form.get('decision'),candidateId:row.id,reason:form.get('reason')});}
 if(!enabled)return <section className={s.card}><h2>Incoming payments</h2><p>Statement intake is being prepared. Your existing Finance tools remain available.</p></section>;
 return <section className={s.card}><h2>Incoming payments</h2><p>Import incoming ZAR payments for review. An import or suggested match does not verify money, allocate a payment or confirm bank settlement.</p>
 {error&&<p role='alert' className={s.error}>{error}</p>}{notice&&<p role='status'>{notice}</p>}
 {data&&<p>{data.counts.map(c=>`${c.status.replaceAll('_',' ')}: ${c.count}`).join(' · ')||'No imported items yet.'}</p>}
 {canRecord&&<details open={!data?.rows.length}><summary>Import a statement (CSV)</summary><form className={s.form} onSubmit={e=>{e.preventDefault();void send({command:'PREVIEW',...upload()});}} onChange={()=>setPreview(null)}><fieldset disabled={busy}>
 <label>Statement source name<input required maxLength={80} value={source} onChange={e=>setSource(e.target.value)} placeholder='School bank statement'/></label>
 <p>Use the same source name for overlapping statements. Do not enter an account number or password.</p>
 {!!data?.profiles.length&&<label>Saved mapping<select defaultValue='' onChange={e=>{const p=data.profiles.find(p=>p.source===e.target.value);if(p){setSource(p.source);setMapping(p.mapping);setDelimiter(p.delimiter);setDecimal(p.decimalSeparator);}}}><option value=''>Choose a previous source</option>{data.profiles.map(p=><option key={p.source} value={p.source}>{p.source}</option>)}</select></label>}
 <label>Column separator<select value={delimiter} onChange={e=>setDelimiter(e.target.value as typeof delimiter)}><option value=','>Comma</option><option value=';'>Semicolon</option><option value={'\t'}>Tab</option></select></label>
 <label>Decimal separator<select value={decimal} onChange={e=>setDecimal(e.target.value as typeof decimal)}><option value='.'>Dot: 125.50</option><option value=','>Comma: 125,50</option></select></label>
 <label>CSV file<input type='file' accept='.csv,text/csv' required onChange={e=>void chooseFile(e.target.files?.[0])}/></label>
 <p>Up to 500 rows. Use YYYY-MM-DD dates and a signed amount column, without currency symbols or thousands separators. Debit and zero amounts are counted and excluded. Other statement formats need conversion before importing.</p>
 {(['date','reference','amount','transactionId'] as const).map(key=><label key={key}>{({date:'Transaction date',reference:'Payment reference',amount:'Signed amount',transactionId:'Unique transaction ID (optional)'})[key]}<select required={key!=='transactionId'} value={mapping[key]??''} onChange={e=>setMapping(m=>({...m,[key]:e.target.value}))}><option value=''>Choose a column</option>{headers.map((h,i)=><option key={`${i}-${h}`} value={h}>{h}</option>)}</select></label>)}
 <button disabled={!headers.length}>Preview import</button>
 </fieldset></form></details>}
 {preview&&<div><h3>Check the import</h3><p>{preview.received} source rows · {preview.ignored} debit/zero rows excluded · {preview.items.length} incoming items · {preview.items.filter(r=>r.duplicateKind).length} need duplicate review</p>
 {!!preview.errors.length&&<ul>{preview.errors.map(e=><li key={e.line}>Row {e.line}: {e.message}</li>)}</ul>}
 <ol>{preview.items.slice(0,20).map(row=><li key={row.line}>{row.date} · {row.reference} · {formatZar(row.amountMinor)} · {row.status.replaceAll('_',' ')}{row.suggestion&&<p>Exact invoice reference: {row.suggestion.invoiceNumber}. {row.suggestion.amountFits?'Amount fits outstanding balance.':'Amount exceeds outstanding balance; review required.'}</p>}</li>)}</ol>
 {preview.items.length>20&&<p>Showing the first 20 of {preview.items.length} items. The complete imported queue is paginated.</p>}
 <button disabled={busy||!!preview.errors.length||!preview.items.length} onClick={()=>void send({command:'IMPORT',...upload(),previewDigest:preview.previewDigest})}>Save {preview.items.length} incoming items for review</button></div>}
 <h3>Review queue</h3>{!data&&!error&&<p role='status'>Loading incoming items…</p>}
 {data?.rows.map(row=><article key={row.id} className={s.card}><h4>{row.reference} · {formatZar(row.amountMinor)}</h4><p>{row.date} · {row.source} · {row.status.replaceAll('_',' ')}</p>{row.transactionId&&<p>Source transaction: {row.transactionId}</p>}
 {row.suggestion&&<p>Suggested invoice: {row.suggestion.invoiceNumber} (exact reference). Outstanding: {formatZar(row.suggestion.outstandingMinor)}. {row.suggestion.amountFits?'Staff must confirm the match before allocation.':'Payment exceeds the outstanding balance; review required.'}</p>}
 {row.status==='DUPLICATE_REVIEW'&&<p>Potential duplicate {row.duplicateKind==='SOURCE_ID'?'transaction ID':'matching payment details'}. No payment has been prepared from this item.</p>}
 {row.reviewReason&&<p>Review: {row.reviewReason}</p>}
 {row.paymentId&&<p>Reported payment reference: IMPORT-{row.id}. Use Fees &amp; payments for independent verification and allocation.</p>}
 {canRecord&&row.status==='READY'&&<button disabled={busy} onClick={()=>void send({command:'REPORT',candidateId:row.id})}>Prepare reported payment</button>}
 {canRecord&&['READY','DUPLICATE_REVIEW'].includes(row.status)&&<form className={s.form} onSubmit={e=>review(e,row)}><fieldset disabled={busy}><label>Reason<input name='reason' required maxLength={500}/></label><label>Decision<select name='decision'><option value='DISMISS'>Dismiss this item</option>{row.status==='DUPLICATE_REVIEW'&&row.duplicateKind==='FINGERPRINT'&&<option value='CONFIRM_DISTINCT'>Confirm this is a separate transaction</option>}</select></label><button>Save intake decision</button></fieldset></form>}
 </article>)}
 {data&&!data.rows.length&&<p>No incoming items on this page.</p>}
 {data&&<div className={s.toolbar}><button disabled={busy||!previous.length} onClick={()=>{setBefore(previous.at(-1)??null);setPrevious(p=>p.slice(0,-1));}}>Newer items</button><button disabled={busy||!data.nextCursor} onClick={()=>{setPrevious(p=>[...p,before]);setBefore(data.nextCursor);}}>Older items</button><button disabled={busy} onClick={()=>setRefresh(v=>v+1)}>Refresh incoming items</button></div>}
 </section>;
}
