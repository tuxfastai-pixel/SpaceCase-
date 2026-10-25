"use client";
import {useEffect,useRef,useState} from 'react';
import {uploadPhoto} from './api';
import {preparePhoto} from './photoPreparation';
import PhotoEditor,{LocalPhoto} from './PhotoEditor';
import styles from './assessment.module.css';
type Item={id:string;file:File;status:'WAITING'|'UPLOADING'|'SAVED'|'FAILED';error?:string;duplicate?:boolean};
export default function UploadPanel({base,disabled,onSaved,onBusy,onPending,collectOnly=false,onAttempted}:{base:string;disabled:boolean;onSaved:()=>Promise<void>;onBusy:(v:boolean)=>void;onPending?:(v:boolean)=>void;collectOnly?:boolean;onAttempted?:()=>void}){
 const [items,setItems]=useState<Item[]>([]);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [editing,setEditing]=useState('');
 const controller=useRef<AbortController|null>(null),mounted=useRef(true),locked=useRef(false),queue=useRef<Item[]>([]);queue.current=items;
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();};},[]);
 useEffect(()=>{onPending?.(items.some(x=>x.status!=='SAVED'));},[items,onPending]);
 function update(id:string,patch:Partial<Item>){if(mounted.current)setItems(xs=>xs.map(x=>x.id===id?{...x,...patch}:x));}
 async function add(files:File[]){
  if(locked.current||disabled||!files.length)return;
  if(files.length+queue.current.length>50){setError('Keep no more than 50 photos in this batch. Clear saved previews to make room.');return;}
  locked.current=true;setBusy(true);onBusy(true);setError('');const failures:string[]=[];
  try{for(const file of files){if(!mounted.current)break;try{const prepared=await preparePhoto(file);if(mounted.current)setItems(xs=>[...xs,{id:crypto.randomUUID(),file:prepared,status:'WAITING'}]);}catch(e){failures.push(`${file.name}: ${e instanceof Error?e.message:'Photo could not be opened.'}`);}}if(mounted.current)setError(failures.join(' '));}
  finally{locked.current=false;if(mounted.current){setBusy(false);onBusy(false);}}
 }
 async function start(){
  if(locked.current||disabled||collectOnly)return;onAttempted?.();locked.current=true;const abort=new AbortController();controller.current=abort;setBusy(true);onBusy(true);setError('');
  try{for(const item of items.filter(x=>x.status!=='SAVED')){
   if(abort.signal.aborted)break;update(item.id,{status:'UPLOADING',error:undefined});
   // Prepared bytes and page UUID stay unchanged across an uncertain result and its retry.
   try{const result=await uploadPhoto(`${base}/pages/${item.id}`,item.file,abort.signal);update(item.id,{status:'SAVED',duplicate:result.duplicate});}
   catch(e){update(item.id,{status:'FAILED',error:e instanceof Error?e.message:'Upload failed.'});}
  }if(mounted.current)await onSaved();}
  catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Reload to check saved photos.');}
  finally{locked.current=false;controller.current=null;if(mounted.current){setBusy(false);onBusy(false);}}
 }
 const saved=items.filter(x=>x.status==='SAVED').length,editor=items.find(x=>x.id===editing&&x.status==='WAITING');
 return <section className={styles.card}><h2>1. Capture or upload work photos</h2><p>Take one page at a time with your phone, or choose existing photos. Add up to 50 pages, review, crop and rotate before uploading. Photos stay on this device until you upload; closing this page discards unsaved pages. Saved photos are private and you will match them to learners next.</p><p>Use good light, hold the camera parallel to the page and include all the writing. Camera availability depends on your device; choosing photos remains available.</p>{disabled?<p className={styles.notice}>Photo uploads are currently unavailable. Check storage configuration or reload saved work.</p>:null}
 {collectOnly?<p className={styles.notice}>Capture pages now. Choose or create an assessment below, then confirm its rubric to upload. Your local pages stay here while you set it up; they are lost if you close or leave this page.</p>:null}
 {error?<p role='alert' className={styles.error}>{error}</p>:null}
 <fieldset className={styles.fieldset} disabled={busy||disabled||!!editor}><div className={styles.grid}><label>Take a page photo<input type='file' accept='image/jpeg,image/png,image/webp' capture='environment' onChange={e=>{const files=Array.from(e.target.files??[]);e.target.value='';void add(files);}}/></label><label>Add existing photos<input type='file' accept='image/jpeg,image/png,image/webp' multiple onChange={e=>{const files=Array.from(e.target.files??[]);e.target.value='';void add(files);}}/></label></div></fieldset>
 {editor?<PhotoEditor key={editor.id} file={editor.file} onApply={file=>{update(editor.id,{file});setEditing('');}} onCancel={()=>setEditing('')}/>:null}
 {items.length?<><p role='status'>{saved} of {items.length} saved{busy?' · Working…':''}</p><div className={styles.photoGrid}>{items.map((x,index)=><article className={styles.queuedPhoto} key={x.id}><h3>Page {index+1}</h3><LocalPhoto file={x.file}/><p>{x.file.name} — {x.status==='SAVED'?(x.duplicate?'Already saved; duplicate skipped':'Saved'):x.status==='UPLOADING'?'Uploading…':x.status==='FAILED'?'Needs retry':'Not uploaded'}</p>{x.error?<p className={styles.error}>{x.error}</p>:null}{x.status==='FAILED'?<p>Retry this same page to confirm its saved status. Editing is locked because the earlier upload may have succeeded.</p>:null}{x.status==='WAITING'?<div className={styles.actions}><button type='button' disabled={busy||disabled||!!editor} onClick={()=>setEditing(x.id)}>Crop / rotate page {index+1}</button><button type='button' disabled={busy||!!editor} onClick={()=>setItems(xs=>xs.filter(i=>i.id!==x.id))}>Remove page {index+1}</button></div>:null}</article>)}</div><div className={styles.actions}><button type='button' disabled={busy||disabled||collectOnly||!!editor||saved===items.length} onClick={()=>void start()}>{items.some(x=>x.status==='FAILED')?'Retry remaining photos':'Upload photos'}</button>{busy&&controller.current?<button type='button' onClick={()=>controller.current?.abort()}>Stop uploads</button>:null}{saved?<button type='button' disabled={busy||!!editor} onClick={()=>setItems(xs=>xs.filter(x=>x.status!=='SAVED'))}>Clear saved previews</button>:null}</div><p>Clear saved previews removes only this device’s preview list. Uploaded work remains in the assessment. Photo preparation removes location metadata; cropping does not transcribe or mark the work.</p></>:null}
 </section>;
}
