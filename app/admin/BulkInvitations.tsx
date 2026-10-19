"use client";
import {useState} from "react";
import {BULK_LIMIT,MAX_IMPORT_SIZE,parseInvitationImport,reviewRecipients,invitationResultsCsv,type ReviewRow,type BulkResult} from "../../platform/invitations/bulk";
import {prepareInvitationMessage,invitationEmailDraft} from "../../platform/invitations/message";
import styles from "./admin.module.css";

function download(name:string,content:string){
  const url=URL.createObjectURL(new Blob([content],{type:"text/csv;charset=utf-8"}));
  const anchor=document.createElement("a");anchor.href=url;anchor.download=name;document.body.append(anchor);anchor.click();anchor.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const reasonText:Record<string,string>={INVITATION_ALREADY_PENDING:"Skipped: invitation already pending",ALREADY_SCHOOL_MEMBER:"Skipped: already a school staff member",SCHOOL_ADMIN_REQUIRED:"Not created: administrator access ended",SERVICE_UNAVAILABLE:"Result unavailable: check Invitations before retrying"};

export default function BulkInvitations({schoolId,schoolName,disabled,onBusyChange,onComplete}:{
  schoolId:string;schoolName:string;disabled:boolean;onBusyChange:(busy:boolean)=>void;onComplete:()=>Promise<void>;
}){
  const [source,setSource]=useState("");const [format,setFormat]=useState<"list"|"csv">("list");
  const [rows,setRows]=useState<ReviewRow[]|null>(null);const [results,setResults]=useState<BulkResult[]|null>(null);
  const [reading,setReading]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [notice,setNotice]=useState("");const [confirmAdmin,setConfirmAdmin]=useState(false);
  const locked=busy||reading||disabled;
  const review=reviewRecipients(rows??[]);const selected=review.filter(row=>row.selected&&!row.issue);
  const adminCount=selected.filter(row=>row.roleCode==="SCHOOL_ADMINISTRATOR").length;
  function edit(index:number,update:Partial<ReviewRow>){setRows(current=>current?.map((row,i)=>i===index?{...row,...update}:row)??null);setConfirmAdmin(false);}
  function preview(){setError("");setNotice("");try{setRows(parseInvitationImport(source,format));setConfirmAdmin(false);}catch(e){setError(e instanceof Error?e.message:"Check your list.");}}
  async function create(){
    if(locked||!selected.length||(adminCount>0&&!confirmAdmin))return;
    setBusy(true);onBusyChange(true);setError("");setNotice("");
    try{
      const response=await fetch(`/api/v1/admin/schools/${schoolId}/invitations/bulk`,{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"content-type":"application/json"},
        body:JSON.stringify({recipients:selected.map(row=>({email:row.email,roleCode:row.roleCode}))})});
      if(response.status===401||response.status===403)throw new Error("Your session or administrator access has ended. Sign in again before creating invitations.");
      if(!response.ok)throw new Error("The batch result could not be confirmed. Refresh Invitations before retrying. Use Replace link for any new pending invitations whose link was not returned.");
      const body=await response.json() as {results:BulkResult[]};setResults(body.results);
      try{await onComplete();}catch{setNotice("Batch results are shown below. Refresh the page after saving your links to update the Invitations list.");}
    }catch(e){setError(e instanceof Error?e.message:"The batch result could not be confirmed. Check Invitations before retrying.");}
    finally{setBusy(false);onBusyChange(false);}
  }
  const created=(results??[]).filter((row):row is Extract<BulkResult,{status:"CREATED"}>=>row.status==="CREATED").map(row=>{
    const message=prepareInvitationMessage({origin:window.location.origin,token:row.token,schoolName,roleCode:row.roleCode,expiresAt:row.expiresAt});
    return {...row,message,draft:invitationEmailDraft(row.email,message)};
  });
  async function copy(text:string){try{await navigator.clipboard.writeText(text);setNotice("Copied. Share it only with the matching recipient. Sending is not confirmed.");}catch{setError("Copying is unavailable in this browser. Use Download invitation links instead.");}}

  return <section className={styles.card} aria-labelledby="bulk-invite-heading">
    <p className={styles.eyebrow}>Invite your team</p><h2 id="bulk-invite-heading">Bulk invitations</h2>
    <p>Paste email addresses or upload a CSV, then review access before creating up to {BULK_LIMIT} invitations. A separate link is created for each person. SpaceCase does not email the batch.</p>
    {error?<p className={styles.error} role="alert">{error}</p>:null}{notice?<p className={styles.notice} role="status">{notice}</p>:null}
    {results===null?<>
      {rows===null?<>
        <label className={styles.field}>Input format<select value={format} disabled={locked} onChange={e=>setFormat(e.target.value as "list"|"csv")}><option value="list">Email list</option><option value="csv">CSV with email and optional role columns</option></select></label>
        <label className={styles.field}>Email list or CSV<textarea rows={6} maxLength={MAX_IMPORT_SIZE} value={source} disabled={locked} onChange={e=>setSource(e.target.value)} placeholder={format==="list"?"One email per line, or separate addresses with commas":"email,role"}/></label>
        <label className={styles.field}>Upload CSV (maximum 64 KB)<input type="file" accept=".csv,text/csv" disabled={locked} onChange={e=>{
          const file=e.target.files?.[0];e.target.value="";if(!file)return;
          if(file.size>MAX_IMPORT_SIZE){setError("Use a CSV file smaller than 64 KB.");return;}
          setReading(true);
          void file.text().then(text=>{setSource(text);setFormat("csv");setError("");}).catch(()=>setError("We couldn’t read that file.")).finally(()=>setReading(false));
        }}/></label>
        <div className={styles.actions}><button className={styles.primary} disabled={locked||!source.trim()} onClick={preview}>Review recipients</button><button className={styles.secondary} disabled={locked} onClick={()=>download("spacecase-staff-template.csv","email,role\r\n")}>Download CSV template</button></div>
        <p className={styles.note}>CSV columns: email and optionally role. Roles: TEACHER or SCHOOL_ADMINISTRATOR. A missing role defaults to Teacher. Lists and uploaded files are reviewed in your browser before selected recipients are submitted.</p>
      </>:<>
        <p>{selected.length} selected · {review.filter(row=>row.issue).length} rows need attention. Invalid and duplicate rows are excluded. Existing pending invitations and staff who previously accepted an invitation at this email will be skipped during creation.</p>
        <div className={styles.tableWrap}><table><thead><tr><th>Include</th><th>Email</th><th>Access</th><th>Review</th></tr></thead><tbody>{review.map((row,index)=><tr key={index}>
          <td><input type="checkbox" aria-label={`Include row ${index+1}`} checked={row.selected&&!row.issue} disabled={locked||Boolean(row.issue)} onChange={e=>edit(index,{selected:e.target.checked})}/></td>
          <td><input aria-label={`Email for row ${index+1}`} type="email" maxLength={254} value={rows[index].email} disabled={locked} onChange={e=>edit(index,{email:e.target.value})}/></td>
          <td><select aria-label={`Access for row ${index+1}`} value={["TEACHER","SCHOOL_ADMINISTRATOR"].includes(row.roleCode)?row.roleCode:""} disabled={locked} onChange={e=>edit(index,{roleCode:e.target.value})}><option value="">Choose role</option><option value="TEACHER">Teacher</option><option value="SCHOOL_ADMINISTRATOR">School administrator</option></select></td>
          <td>{row.issue??(row.selected?"Ready":"Excluded")}</td></tr>)}</tbody></table></div>
        {adminCount>0?<label className={styles.confirmation}><input type="checkbox" checked={confirmAdmin} disabled={locked} onChange={e=>setConfirmAdmin(e.target.checked)}/>I intend to invite {adminCount} school administrator{adminCount===1?"":"s"} with school administration access.</label>:null}
        <div className={styles.actions}><button className={styles.primary} disabled={locked||!selected.length||(adminCount>0&&!confirmAdmin)} onClick={()=>void create()}>{busy?"Creating invitations…":`Create ${selected.length} invitation links`}</button><button className={styles.secondary} disabled={locked} onClick={()=>{setRows(null);setError("");}}>Back to input</button></div>
      </>}
    </>:<>
      <p role="status">{created.length} links created · {results.filter(r=>r.status==="SKIPPED").length} skipped · {results.filter(r=>r.status==="FAILED").length} need attention. No emails sent by SpaceCase.</p>
      <p>Save or copy the new links before leaving. They are shown only for this session. Keep the downloaded file private; use each link only for its matching email address.</p>
      {created.length?<button className={styles.primary} disabled={locked} onClick={()=>download(`spacecase-invitations-${new Date().toISOString().slice(0,10)}.csv`,invitationResultsCsv(created.map(row=>({email:row.email,roleCode:row.roleCode,link:row.message.link,expiresAt:row.expiresAt}))))}>Download invitation links</button>:null}
      <div className={styles.tableWrap}><table><thead><tr><th>Email</th><th>Access</th><th>Result</th><th>Share</th></tr></thead><tbody>{results.map(row=>{
        const share=created.find(value=>value.email===row.email);
        return <tr key={row.email}><td>{row.email}</td><td>{row.roleCode==="TEACHER"?"Teacher":"School administrator"}</td><td>{row.status==="CREATED"?"Link created · Email not sent":reasonText[row.reason]??"Not created"}</td><td>{share?<div className={styles.actions}><button className={styles.secondary} onClick={()=>void copy(share.message.link)}>Copy link</button><button className={styles.secondary} onClick={()=>void copy(share.message.text)}>Copy message</button><a className={styles.secondary} href={share.draft} onClick={()=>setNotice("Email draft requested. Review and press Send in your email app; sending is not confirmed.")}>Open email draft</a></div>:null}</td></tr>;
      })}</tbody></table></div>
      <p className={styles.note}>Skipped invitations are not replaced and existing staff roles are not changed. If a pending link is missing, use Replace link in Invitations. Opening an email draft does not confirm sending or delivery.</p>
      <button className={styles.secondary} disabled={locked} onClick={()=>{setResults(null);setRows(null);setSource("");setError("");setNotice("");setConfirmAdmin(false);}}>Start a new import (clears these links)</button>
    </>}
  </section>;
}
