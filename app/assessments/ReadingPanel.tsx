"use client";
import {useState} from "react";
import type {AssessmentDetail,Submission} from "./api";
import styles from "./assessment.module.css";
export default function ReadingPanel({data,submission,busy,onAction,onDirty}:{data:AssessmentDetail;submission:Submission;busy:boolean;onAction:(v:unknown)=>Promise<void>;onDirty:(v:boolean)=>void}){
 const [values,setValues]=useState(()=>(submission.reading?.pages??[]).map(p=>{const saved=submission.readingReview?.find(r=>r.pageId===p.pageId);return {pageId:p.pageId,transcription:saved?.transcription??p.transcription,uncertain:saved?.uncertain??p.uncertain,reviewed:saved?.reviewed??false};}));
 const [dirty,setDirty]=useState(false);const [error,setError]=useState("");
 function update(id:string,patch:Partial<typeof values[number]>){setValues(xs=>xs.map(x=>x.pageId===id?{...x,...patch}:x));setDirty(true);onDirty(true);}
 async function save(){if(values.some(v=>!v.reviewed)){setError("Check every page against the photo and tick each reviewed box.");return;}setError("");await onAction({action:"SAVE_READING",submissionId:submission.id,revision:submission.revision,pages:values});}
 if(!submission.reading)return null;
 return <section className={styles.card}><h3>Check the extracted text</h3><p>The assistant’s reading can contain errors. Compare it with the original photos above, correct the text, and leave unresolved words flagged. This review does not award marks.</p><p>Read by {submission.reading.modelRef} · {submission.reading.policyVersion}</p>{error?<p role="alert" className={styles.error}>{error}</p>:null}
 <fieldset disabled={busy||Boolean(submission.reviewScores)||Boolean(submission.currentResultId)} className={styles.fieldset}>
 {values.map(v=>{const raw=submission.reading!.pages.find(r=>r.pageId===v.pageId)!;const page=data.pages.find(p=>p.id===v.pageId);return <section key={v.pageId} className={styles.card}><h4>Page {page?.pageNumber}</h4>{raw.warnings.length?<ul>{raw.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul>:null}<label>Extracted text—edit after checking the photo<textarea rows={8} maxLength={12000} value={v.transcription} onChange={e=>update(v.pageId,{transcription:e.target.value,reviewed:false})}/></label><label className={styles.check}><input type="checkbox" checked={v.uncertain} onChange={e=>update(v.pageId,{uncertain:e.target.checked,reviewed:false})}/>Some words or diagrams remain unclear.</label><label className={styles.check}><input type="checkbox" checked={v.reviewed} onChange={e=>update(v.pageId,{reviewed:e.target.checked})}/>I checked this reading against the original page.</label><details><summary>Original assistant transcription</summary><p className={styles.pre}>{raw.transcription}</p></details></section>;})}
 <button className={styles.primary} disabled={!dirty&&Boolean(submission.readingReview)} onClick={()=>void save()}>Save checked transcription</button></fieldset>
 {dirty?<details><summary>Copy unsaved transcription before reloading</summary><label>Unsaved text<textarea readOnly rows={10} value={values.map(v=>v.transcription).join("\n\n")}/></label></details>:null}</section>;
}
