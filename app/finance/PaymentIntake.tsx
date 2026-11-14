"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {z} from 'zod';
import {csvCells} from '../../domains/school-finance/intakeCsvCells';
import {formatZar} from './forms';
import {FinanceIcon,FinanceStatus} from './FinanceUi';
import {financeDateLabel,suggestedStatementMapping} from './presentation';
import s from './finance.module.css';
const suggestion=z.object({invoiceNumber:z.string(),outstandingMinor:z.string(),amountFits:z.boolean()}).nullable();
const item=z.object({id:z.string(),source:z.string(),date:z.string(),reference:z.string(),transactionId:z.string().nullable(),amountMinor:z.string(),status:z.enum(['READY','DUPLICATE_REVIEW','REPORTED','DISMISSED']),duplicateKind:z.string().nullable(),paymentId:z.string().nullable(),reviewReason:z.string().nullable(),suggestion});
const mappingSchema=z.object({date:z.string(),reference:z.string(),amount:z.string(),transactionId:z.string().optional()});
const queueSchema=z.object({rows:z.array(item),profiles:z.array(z.object({source:z.string(),mapping:mappingSchema,delimiter:z.enum([',',';','\t']),decimalSeparator:z.enum(['.',',']),headerSignature:z.string()})),counts:z.array(z.object({status:z.string(),count:z.number()})),nextCursor:z.string().nullable()});
const previewSchema=z.object({received:z.number(),ignored:z.number(),errors:z.array(z.object({line:z.number(),message:z.string()})),previewDigest:z.string(),items:z.array(z.object({line:z.number(),date:z.string(),reference:z.string(),amountMinor:z.string(),status:z.string(),duplicateKind:z.string().nullable(),suggestion}))});
type Mapping=z.infer<typeof mappingSchema>;
const messages:Record<string,string>={PREVIEW_CHANGED_REVIEW_AGAIN:'The records changed. Preview this file again before importing.',VALID_CREDIT_ROWS_REQUIRED:'Correct the invalid rows and preview again. At least one positive incoming payment is required.',SOURCE_TRANSACTION_ID_MUST_BE_UNIQUE:'That transaction ID is already present. Correct the source or dismiss this duplicate; it cannot be treated as a different transaction.',PAYMENT_INTAKE_NOT_ENABLED:'Payment intake is not activated in this environment.',REVIEW_DUPLICATE_OR_DISMISSED_ITEM:'Resolve the duplicate before preparing a payment.',ITEM_ALREADY_PROCESSED:'This item has already been processed. Refresh the queue.'};
async function read(response:Response){const body=await response.json();if(!response.ok)throw Error(messages[body.error]??'The request could not be completed. Check your access and refresh before trying again.');return body;}
export default function PaymentIntake({schoolId,accountId,canRecord,enabled,active=true,onReported}:{schoolId:string;accountId:string;canRecord:boolean;enabled:boolean;active?:boolean;onReported:()=>void}) {
 const [data,setData]=useState<z.infer<typeof queueSchema>|null>(null);
 const [csv,setCsv]=useState(''),[filename,setFilename]=useState(''),[headers,setHeaders]=useState<string[]>([]);
 const [source,setSource]=useState(''),[delimiter,setDelimiter]=useState<','|';'|'\t'>(','),[decimal,setDecimal]=useState<'.'|','>('.');
 const [mapping,setMapping]=useState<Mapping>({date:'',reference:'',amount:''});
 const [preview,setPreview]=useState<z.infer<typeof previewSchema>|null>(null);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0);
 const [before,setBefore]=useState<string|null>(null),[previous,setPrevious]=useState<(string|null)[]>([]);
 const [step,setStep]=useState(1),[importOpen,setImportOpen]=useState(false),[lastImport,setLastImport]=useState<{count:number;replayed:boolean}|null>(null);
 const pending=useRef(false),post=useRef<AbortController|null>(null),fileVersion=useRef(0);
 const heading=useRef<HTMLHeadingElement>(null),queueHeading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>()=>post.current?.abort(),[]);
 useEffect(()=>{if(importOpen&&active)heading.current?.focus({preventScroll:true});},[step,importOpen,active]);
 useEffect(()=>{
  setPreview(null);if(!csv){setHeaders([]);return;}
  try {
   const h=csvCells(csv,delimiter)[0].map(v=>v.trim());setHeaders(h);setError('');
   setMapping(current=>{const suggested=suggestedStatementMapping(h);return {...suggested,...Object.fromEntries(Object.entries(current).filter(([,value])=>h.includes(value)))};});
  }catch{setHeaders([]);setError('We could not read the columns. Check the file separator under File settings, or choose the CSV again.');}
 },[csv,delimiter]);
 useEffect(()=>{
  if(!enabled||!active)return;
  const controller=new AbortController();setError('');
  const params=new URLSearchParams({schoolId,accountId});if(before)params.set('before',before);
  void fetch(`/api/finance/intake?${params}`,{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])})
   .then(read).then(body=>{if(!controller.signal.aborted)setData(queueSchema.parse(body));})
   .catch(e=>{if(!controller.signal.aborted){setData(null);setError(e instanceof Error?e.message:'The receipt queue could not be loaded.');}});
  return ()=>controller.abort();
 },[schoolId,accountId,before,refresh,enabled,active]);
 async function send(command:Record<string,unknown>) {
  if(pending.current)return;pending.current=true;setBusy(true);setError('');setNotice('');
  const controller=new AbortController();post.current=controller;
  try {
   const body=await read(await fetch('/api/finance/intake',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({schoolId,accountId,...command}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(30000)])}));
   if(controller.signal.aborted)return;
   if(command.command==='PREVIEW'){setPreview(previewSchema.parse(body));setStep(3);}
   else {
    if(command.command==='IMPORT'){
     setLastImport({count:body.imported,replayed:body.replayed});setStep(4);setPreview(null);setBefore(null);setPrevious([]);
     setNotice(body.replayed?'This statement is already imported. No duplicate entries were added.':`${body.imported} statement entries imported. They are ready for receipt capture.`);
    }else if(command.command==='REPORT'){setNotice('Receipt captured. Open Fees & receipts to check its verification status.');onReported();}
    else setNotice(command.command==='DISMISS'?'Entry excluded from capture. Your reason is saved.':'Separate transaction confirmed. It is now available for receipt capture.');
    setRefresh(v=>v+1);
   }
  }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'The request could not be completed.');}
  finally{pending.current=false;if(!controller.signal.aborted)setBusy(false);}
 }
 function upload(){return {source,csv,delimiter,decimalSeparator:decimal,mapping:Object.fromEntries(Object.entries(mapping).filter(([,v])=>v))};}
 async function chooseFile(file:File|undefined){
  const version=++fileVersion.current;setPreview(null);setError('');setCsv('');setFilename('');
  if(!file)return;if(file.size>262144){setError('Choose a CSV smaller than 256 KiB. You can split a longer statement into smaller files.');return;}
  try{const text=await file.text();if(version===fileVersion.current){setCsv(text);setFilename(file.name);}}
  catch{if(version===fileVersion.current)setError('The file could not be opened. Choose it again.');}
 }
 function review(event:FormEvent<HTMLFormElement>,row:z.infer<typeof item>){event.preventDefault();const form=new FormData(event.currentTarget);void send({command:form.get('decision'),candidateId:row.id,reason:form.get('reason')});}
 function restart(){setStep(1);setPreview(null);setLastImport(null);setCsv('');setFilename('');setError('');setImportOpen(true);}
 function openQueue(){setImportOpen(false);queueHeading.current?.focus();queueHeading.current?.scrollIntoView({block:'start'});}
 const receivedTotal=preview?.items.reduce((sum,row)=>sum+BigInt(row.amountMinor),0n).toString()??'0';
 const attention=data?.rows.filter(row=>row.status==='READY'||row.status==='DUPLICATE_REVIEW')??[];
 const completed=data?.rows.filter(row=>row.status==='REPORTED'||row.status==='DISMISSED')??[];
 function receipt(row:z.infer<typeof item>){return <details className={s.receiptCard} key={row.id} open={row.status==='READY'||row.status==='DUPLICATE_REVIEW'}>
  <summary><span className={s.receiptSummary}><strong>{row.reference}</strong><span className={s.amount}>{formatZar(row.amountMinor)}</span><FinanceStatus value={row.status} context='intake'/></span></summary>
  <p className={s.note}>{financeDateLabel(row.date)} · {row.source}</p>
  {row.suggestion&&<div className={s.softPanel}><strong>Suggested invoice: {row.suggestion.invoiceNumber}</strong><p>Exact reference match · Outstanding {formatZar(row.suggestion.outstandingMinor)}. {row.suggestion.amountFits?'Check the match before allocation.':'This receipt exceeds the outstanding balance. Check before allocating.'}</p></div>}
  {row.status==='DUPLICATE_REVIEW'&&<p><FinanceIcon name='warning'/> {row.duplicateKind==='SOURCE_ID'?'This transaction ID is already in the records. Exclude this entry if it is a repeat.':'A similar payment is already in the records. Check whether this is a repeat or a separate transaction.'}</p>}
  {row.reviewReason&&<p><strong>Review note:</strong> {row.reviewReason}</p>}
  {canRecord&&row.status==='READY'&&<div className={s.actions}><button disabled={busy} onClick={()=>void send({command:'REPORT',candidateId:row.id})}><FinanceIcon name='receipts'/>Capture receipt</button><span className={s.fileHelp}>Independent verification follows capture.</span></div>}
  {canRecord&&['READY','DUPLICATE_REVIEW'].includes(row.status)&&<details className={s.details}><summary>{row.status==='DUPLICATE_REVIEW'?'Resolve this duplicate check':'Exclude this statement entry'}</summary><form className={s.form} onSubmit={e=>review(e,row)}><fieldset disabled={busy}><label>Reason for your decision<input name='reason' required maxLength={500} placeholder='Explain what you checked'/></label><label>Decision<select name='decision'><option value='DISMISS'>Exclude from receipt capture</option>{row.status==='DUPLICATE_REVIEW'&&row.duplicateKind==='FINGERPRINT'&&<option value='CONFIRM_DISTINCT'>This is a separate transaction</option>}</select></label><button className={s.secondary}><FinanceIcon name='check'/>Save decision</button></fieldset></form></details>}
  <details className={s.details}><summary>Statement and receipt references</summary>{row.transactionId&&<p>Statement transaction ID: {row.transactionId}</p>}{row.paymentId?<p>Receipt reference: <code>IMPORT-{row.id}</code>. Open Fees &amp; receipts for its current verification and allocation status.</p>:<p>This statement entry has not been captured as a receipt.</p>}</details>
 </details>;}
 if(!enabled)return <section className={s.card}><h2>Receipt imports</h2><p>Statement imports are being prepared. Your existing finance tools remain available.</p></section>;
 return <section className={s.card} aria-label='Statement imports and receipt capture'>
  <div className={s.intro}><div><h2 className={s.sectionTitle}><FinanceIcon name='import'/>Import receipts</h2><p>Bring in statement entries, check them, then capture receipts for verification.</p></div>{canRecord&&<button disabled={busy} onClick={()=>{if(step===4)restart();else setImportOpen(v=>!v);}}><FinanceIcon name='file'/>{importOpen?'Close import steps':'Import a statement'}</button>}</div>
  {error&&<p role='alert' className={s.error}>{error}</p>}{notice&&<p role='status' className={s.success}><FinanceIcon name='check'/> {notice}</p>}
  <div className={s.summaryTiles} aria-label='All imported entries'>{(['READY','DUPLICATE_REVIEW','REPORTED','DISMISSED'] as const).map(status=><div key={status}><span>{({READY:'Awaiting capture',DUPLICATE_REVIEW:'Duplicate checks',REPORTED:'Captured in receipts',DISMISSED:'Excluded entries'})[status]}</span><strong>{data?data.counts.find(c=>c.status===status)?.count??0:'—'}</strong></div>)}</div>
  {canRecord&&importOpen&&<div className={s.wizard}>
   <ol className={s.steps} aria-label='Statement import steps'>{['Choose statement','Match columns','Check and import'].map((label,index)=><li key={label} aria-current={Math.min(step,3)===index+1?'step':undefined}><span className={s.stepNumber}>{step>index+1?<FinanceIcon name='check'/>:index+1}</span>{label}</li>)}</ol>
   <h3 ref={heading} tabIndex={-1} className={s.wizardHeading}>{({1:'1. Choose your statement',2:'2. Match the statement columns',3:'3. Check the receipts',4:'Statement imported'})[step]}</h3>
   {step===1&&<form className={s.form} onSubmit={e=>{e.preventDefault();if(csv&&headers.length)setStep(2);}}><fieldset disabled={busy}>
    {!!data?.profiles.length&&<label>Use a saved statement layout (optional)<select defaultValue='' onChange={e=>{const p=data.profiles.find(p=>p.source===e.target.value);if(p){setSource(p.source);setMapping(p.mapping);setDelimiter(p.delimiter);setDecimal(p.decimalSeparator);}}}><option value=''>Start with a new source</option>{data.profiles.map(p=><option key={p.source} value={p.source}>{p.source}</option>)}</select></label>}
    <label>Bank / statement source label<input required maxLength={80} pattern='[A-Za-z0-9][A-Za-z0-9 _-]*' title='Use letters, numbers, spaces, hyphens or underscores.' value={source} onChange={e=>setSource(e.target.value)} placeholder='For example: School bank'/><small>A short name you can use again next time. No account number or password is needed.</small></label>
    <label>Choose a statement CSV<input type='file' accept='.csv,.tsv,text/csv,text/tab-separated-values' required={!csv} onChange={e=>void chooseFile(e.target.files?.[0])}/></label>
    {filename&&<p className={s.fileHelp}><FinanceIcon name='file'/> {filename}</p>}
    <details className={s.details}><summary>File settings and supported formats</summary><p>Up to 500 rows and 256 KiB. Dates must be YYYY-MM-DD or YYYY/MM/DD. Use one signed amount column in rand and cents, without currency symbols or thousands separators. Other layouts need conversion first.</p><label>Column separator<select value={delimiter} onChange={e=>setDelimiter(e.target.value as typeof delimiter)}><option value=','>Comma</option><option value=';'>Semicolon</option><option value={'\t'}>Tab</option></select></label><label>Decimal separator<select value={decimal} onChange={e=>setDecimal(e.target.value as typeof decimal)}><option value='.'>Dot — 125.50</option><option value=','>Comma — 125,50</option></select></label></details>
    <button disabled={!csv||!headers.length}>Continue to column matching<FinanceIcon name='next'/></button>
   </fieldset></form>}
   {step===2&&<form className={s.form} onSubmit={e=>{e.preventDefault();void send({command:'PREVIEW',...upload()});}} onChange={()=>setPreview(null)}><fieldset disabled={busy}>
    <p className={s.fileHelp}>{filename} · {source}. Suggested columns are filled only when the headings are unambiguous. Check each choice.</p>
    {(['date','reference','amount','transactionId'] as const).map(key=><label key={key}>{({date:'Statement date',reference:'Payment / invoice reference',amount:'Amount received or paid out',transactionId:'Transaction ID (optional)'})[key]}<select required={key!=='transactionId'} value={mapping[key]??''} onChange={e=>setMapping(m=>({...m,[key]:e.target.value}))}><option value=''>{key==='transactionId'?'No transaction ID column':'Choose the matching column'}</option>{headers.map((h,i)=><option key={`${i}-${h}`} value={h}>{h}</option>)}</select></label>)}
    <p className={s.fileHelp}>Positive amounts become incoming entries. Negative and zero amounts are counted and excluded from this receipt import.</p>
    <div className={s.actions}><button type='button' className={s.secondary} onClick={()=>setStep(1)}><FinanceIcon name='back'/>Back to file</button><button><FinanceIcon name='search'/>{busy?'Checking statement…':'Preview receipts'}</button></div>
   </fieldset></form>}
   {step===3&&preview&&<>
    <div className={s.summaryTiles}><div><span>Source rows</span><strong>{preview.received}</strong></div><div><span>Money in</span><strong>{formatZar(receivedTotal)}</strong></div><div><span>Debit / zero rows excluded</span><strong>{preview.ignored}</strong></div><div><span>Possible duplicates</span><strong>{preview.items.filter(r=>r.duplicateKind).length}</strong></div></div>
    {!!preview.errors.length&&<div role='alert' className={s.error}><strong>Correct these rows before importing.</strong><ul>{preview.errors.map(e=><li key={e.line}>Row {e.line}: {e.message}</li>)}</ul></div>}
    <div className={s.tableWrap} role='region' aria-label='Statement preview' tabIndex={0}><table><caption>{preview.items.length>20?`First 20 of ${preview.items.length} incoming entries`:'Incoming entries for review'}</caption><thead><tr><th>Date</th><th>Statement reference</th><th>Amount</th><th>Check</th></tr></thead><tbody>{preview.items.slice(0,20).map(row=><tr key={row.line}><td>{financeDateLabel(row.date)}</td><td>{row.reference}{row.suggestion&&<small>Suggested invoice: {row.suggestion.invoiceNumber} · exact reference match{row.suggestion.amountFits?'':' · exceeds outstanding balance'}</small>}</td><td>{formatZar(row.amountMinor)}</td><td><FinanceStatus value={row.status} context='intake'/></td></tr>)}</tbody></table></div>
    <p className={s.fileHelp}>Importing adds statement entries to the review queue. Receipt capture, independent verification and invoice allocation are separate steps.</p>
    <div className={s.actions}><button className={s.secondary} disabled={busy} onClick={()=>setStep(2)}><FinanceIcon name='back'/>Edit column choices</button><button disabled={busy||!!preview.errors.length||!preview.items.length} onClick={()=>void send({command:'IMPORT',...upload(),previewDigest:preview.previewDigest})}><FinanceIcon name='import'/>{busy?'Importing…':`Import ${preview.items.length} entries to review`}</button></div>
   </>}
   {step===4&&lastImport&&<><p>{lastImport.replayed?'This statement was already imported. No duplicate entries were added.':`${lastImport.count} statement entries are ready in the review queue. Your column layout is saved for next time.`}</p><div className={s.actions}><button onClick={openQueue}><FinanceIcon name='receipts'/>Review imported entries</button><button className={s.secondary} onClick={restart}>Import another statement</button></div></>}
  </div>}
  <div className={s.queueTools}><h3 ref={queueHeading} tabIndex={-1} className={s.wizardHeading}>Receipts needing attention</h3><button className={s.secondary} disabled={busy} onClick={()=>setRefresh(v=>v+1)}><FinanceIcon name='refresh'/>Refresh queue</button></div>
  {!data&&!error&&<p role='status'>Loading statement entries…</p>}
  {data&&<p className={s.fileHelp}>Page {previous.length+1} · {data.rows.length} entries on this page. Completed items are grouped below.</p>}
  {attention.map(receipt)}
  {data&&!attention.length&&<p className={s.softPanel}><FinanceIcon name='check'/> No entries need capture or duplicate review on this page.</p>}
  {!!completed.length&&<details className={s.details}><summary>Captured and excluded entries on this page ({completed.length})</summary>{completed.map(receipt)}</details>}
  {data&&<div className={s.actions}><button className={s.secondary} disabled={busy||!previous.length} onClick={()=>{setBefore(previous.at(-1)??null);setPrevious(p=>p.slice(0,-1));}}><FinanceIcon name='back'/>Newer entries</button><button className={s.secondary} disabled={busy||!data.nextCursor} onClick={()=>{setPrevious(p=>[...p,before]);setBefore(data.nextCursor);}}>Older entries<FinanceIcon name='next'/></button></div>}
  <details className={s.details}><summary><FinanceIcon name='help'/>What happens after import?</summary><p>1. Check the statement entry. 2. Capture the receipt. 3. A different authorised person verifies it against evidence. 4. Allocate verified money to the correct invoice. Imported entries do not establish bank settlement.</p></details>
 </section>;
}
