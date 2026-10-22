"use client";
import {useEffect,useRef,useState} from "react";
import {uploadPhoto} from "./api";
import styles from "./assessment.module.css";
type Item={id:string;file:File;status:"WAITING"|"UPLOADING"|"SAVED"|"FAILED";error?:string;duplicate?:boolean};
async function prepare(file:File){
 if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>20000000)throw new Error("Choose JPG, PNG or WebP photos below 20 MB. Convert HEIC photos to JPG first.");
 const bitmap=await createImageBitmap(file);try{
  if(bitmap.width*bitmap.height>24000000||Math.min(bitmap.width,bitmap.height)<100)throw new Error("Use a clear photo between 100 pixels and 24 megapixels.");
  const ratio=Math.min(1,1800/bitmap.width,2400/bitmap.height);const canvas=document.createElement("canvas");canvas.width=Math.round(bitmap.width*ratio);canvas.height=Math.round(bitmap.height*ratio);const context=canvas.getContext("2d");if(!context)throw new Error("Your browser could not prepare this image.");context.fillStyle="white";context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(v=>v?resolve(v):reject(new Error("Photo conversion failed.")),"image/jpeg",.85));if(blob.size>2097152)throw new Error("This photo is still too large after preparation. Use a smaller photo.");return blob;
 }finally{bitmap.close();}
}
export default function UploadPanel({base,disabled,onSaved,onBusy}:{base:string;disabled:boolean;onSaved:()=>Promise<void>;onBusy:(v:boolean)=>void}){
 const [items,setItems]=useState<Item[]>([]);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const controller=useRef<AbortController|null>(null);const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false;controller.current?.abort();};},[]);
 function update(id:string,patch:Partial<Item>){if(mounted.current)setItems(xs=>xs.map(x=>x.id===id?{...x,...patch}:x));}
 async function start(){
  if(busy)return;const abort=new AbortController();controller.current=abort;setBusy(true);onBusy(true);setError("");
  try{for(const item of items.filter(x=>x.status!=="SAVED")){
   if(abort.signal.aborted)break;update(item.id,{status:"UPLOADING",error:undefined});
   try{const blob=await prepare(item.file);if(abort.signal.aborted)throw new Error("Upload stopped. Retry to confirm this photo.");const result=await uploadPhoto(`${base}/pages/${item.id}`,blob,abort.signal);update(item.id,{status:"SAVED",duplicate:result.duplicate});}
   catch(e){update(item.id,{status:"FAILED",error:e instanceof Error?e.message:"Upload failed."});}
  }
  if(mounted.current)await onSaved();
  }catch(e){if(mounted.current)setError(e instanceof Error?e.message:"Reload to check saved photos.");}finally{if(mounted.current){setBusy(false);onBusy(false);}}
 }
 const saved=items.filter(x=>x.status==="SAVED").length;
 return <section className={styles.card}><h2>1. Upload work photos</h2><p>Choose up to 50 JPG, PNG or WebP photos at a time. Photos are prepared individually, stripped of location metadata and saved privately. You will match them to learners next.</p>{disabled?<p className={styles.notice}>Photo storage is awaiting configuration.</p>:null}
 {error?<p role="alert" className={styles.error}>{error}</p>:null}
 <label>Choose photos<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy||disabled} onChange={e=>{const files=Array.from(e.target.files??[]);if(files.length>50){setError("Choose no more than 50 photos per batch.");return;}setError("");setItems(files.map(file=>({id:crypto.randomUUID(),file,status:"WAITING"})));}}/></label>
 {items.length?<><p role="status">{saved} of {items.length} saved</p><ul className={styles.uploadList}>{items.map(x=><li key={x.id}><strong>{x.file.name}</strong> — {x.status==="SAVED"?(x.duplicate?"Already saved; duplicate skipped":"Saved"):x.status==="UPLOADING"?"Uploading…":x.status==="FAILED"?"Needs retry":"Waiting"}{x.error?<p className={styles.error}>{x.error}</p>:null}</li>)}</ul><div className={styles.actions}><button disabled={busy||disabled||saved===items.length} onClick={()=>void start()}>{items.some(x=>x.status==="FAILED")?"Retry remaining photos":"Upload photos"}</button>{busy?<button onClick={()=>controller.current?.abort()}>Stop uploads</button>:null}</div></>:null}
 </section>;
}
