"use client";
import { useEffect, useState } from "react";
import styles from "./admin.module.css";

type Details = {revision:number; emisNumber:string; centreNumber:string; address:string; country:string; province:string; district:string; postalCode:string; phone:string; email:string; schoolType:string};
const fields: {key:Exclude<keyof Details,"revision">; label:string; max:number; type?:string; hint?:string}[] = [
  {key:"emisNumber",label:"EMIS number",max:80,hint:"The school's education management information number, if assigned."},
  {key:"centreNumber",label:"Examination centre number",max:80,hint:"Enter the centre number if your school has one; it may differ from the EMIS number."},
  {key:"address",label:"School address",max:500}, {key:"country",label:"Country",max:100},
  {key:"province",label:"Province or region",max:100}, {key:"district",label:"Education district",max:100},
  {key:"postalCode",label:"Postal code",max:30}, {key:"schoolType",label:"School type or phase",max:100,hint:"For example, primary, secondary or combined."},
  {key:"phone",label:"School phone or mobile",max:50,type:"tel"}, {key:"email",label:"School email",max:254,type:"email"},
];
export default function SchoolDetails({schoolId,onDirty}:{schoolId:string;onDirty:(dirty:boolean)=>void}) {
  const [details,setDetails]=useState<Details|null>(null);
  const [baseline,setBaseline]=useState("");
  const [error,setError]=useState(""); const [notice,setNotice]=useState(""); const [saving,setSaving]=useState(false);
  useEffect(()=>{ const controller=new AbortController();
    fetch(`/api/v1/admin/schools/${encodeURIComponent(schoolId)}/profile`,{cache:"no-store",signal:controller.signal})
      .then(async response=>{if(!response.ok) throw new Error(); return response.json();})
      .then(data=>{setDetails(data.profile);setBaseline(JSON.stringify(data.profile));})
      .catch(()=>{if(!controller.signal.aborted)setError("School details are temporarily unavailable. Please try again later.");});
    return ()=>controller.abort();
  },[schoolId]);
  useEffect(()=>{onDirty(details!==null && JSON.stringify(details)!==baseline);},[details,baseline,onDirty]);
  async function save() {
    if(!details)return; setSaving(true);setError("");setNotice("");
    try { const response=await fetch(`/api/v1/admin/schools/${encodeURIComponent(schoolId)}/profile`,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(details)});
      if(response.status===409) throw new Error("These details changed elsewhere. Your edits are still here; copy them before refreshing to review the latest version.");
      if(!response.ok) throw new Error("We couldn’t save the details. Check the email address and try again.");
      const data=await response.json();setDetails(data.profile);setBaseline(JSON.stringify(data.profile));setNotice("School details saved.");
    } catch(e) {setError(e instanceof Error?e.message:"Unable to save. Please try again.");} finally {setSaving(false);}
  }
  return <section className={styles.card}><h2>School details</h2><p>Keep your school’s identification and contact details together. All fields are optional and can be updated later. This does not send information to the education department.</p>
    {error?<p className={styles.error} role="alert">{error}</p>:null}{notice?<p className={styles.notice} role="status">{notice}</p>:null}
    {details?<form onSubmit={e=>{e.preventDefault();void save();}}><fieldset className={styles.detailsGrid} disabled={saving}><legend className={styles.srOnly}>Optional school identification and contact details</legend>{fields.map(field=><label className={field.key==="address"?`${styles.field} ${styles.fullWidth}`:styles.field} key={field.key}>{field.label}{field.hint?<small>{field.hint}</small>:null}{field.key==="address"?<textarea maxLength={field.max} value={details[field.key]} onChange={e=>setDetails({...details,[field.key]:e.target.value})}/>:<input type={field.type??"text"} maxLength={field.max} value={details[field.key]} onChange={e=>setDetails({...details,[field.key]:e.target.value})}/>}</label>)}</fieldset><button className={styles.primary} disabled={saving}>{saving?"Saving…":"Save school details"}</button></form>:!error?<p>Loading school details…</p>:null}
  </section>;
}
