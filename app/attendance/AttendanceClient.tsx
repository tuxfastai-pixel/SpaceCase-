"use client";
import {useCallback,useEffect,useState} from "react";
import type {AttendanceStatus} from "../../domains/attendance/contracts";
import TeacherGuide from "../teacher-help/TeacherGuide";
import styles from "../admin/admin.module.css";
type Learner={personId:string;admissionNumber:string;givenName:string;familyName:string;status:AttendanceStatus};
type Register={class:{id:string;name:string;academicYear:number|null};date:string;today:string;timezone:string;revision:number;updatedAt:string|null;learners:Learner[]};
const statuses:AttendanceStatus[]=["UNMARKED","PRESENT","ABSENT","LATE","EXCUSED"];
const label:Record<AttendanceStatus,string>={UNMARKED:"Unmarked",PRESENT:"Present",ABSENT:"Absent",LATE:"Late",EXCUSED:"Excused"};
const messages:Record<string,string>={
 UNAUTHENTICATED:"Your session has ended. Sign in again to continue.",CLASS_ACCESS_REQUIRED:"You no longer have teacher access to this class.",
 CLASS_WORKSPACE_REQUIRED:"Your administrator needs to connect this class to the school learning workspace.",
 FUTURE_DATE:"Choose today or an earlier date in the school timezone.",INVALID_INPUT:"Check the date, attendance marks and correction reason.",
 ROSTER_CHANGED:"The class list has changed. Reload the register and review the current learners before saving.",
 REGISTER_CHANGED:"Someone has saved this register since you opened it. Reload and review their changes before saving.",
 ROSTER_TOO_LARGE:"This register exceeds the supported limit of 1,000 learners. Ask your administrator to review the class setup.",
};
async function request<T>(url:string,method="GET",body?:unknown,signal?:AbortSignal){
 const r=await fetch(url,{method,headers:{"content-type":"application/json"},body:body===undefined?undefined:JSON.stringify(body),credentials:"same-origin",cache:"no-store",signal});
 const value=await r.json();if(!r.ok)throw new Error(messages[value.error]??"Attendance is temporarily unavailable. Reload before trying again.");
 return value as T;
}
export default function AttendanceClient({schoolId,classId}:{schoolId:string;classId:string}){
 const base=`/api/v1/schools/${schoolId}/classes/${classId}/attendance`;
 const [date,setDate]=useState("");const [data,setData]=useState<Register|null>(null);const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");const [notice,setNotice]=useState("");const [dirty,setDirty]=useState(false);const [stale,setStale]=useState(false);
 const [reason,setReason]=useState<"CORRECTION"|"LATE_UPDATE"|"ROSTER_UPDATE">("CORRECTION");
 const load=useCallback(async(signal?:AbortSignal)=>{
  const value=await request<Register>(`${base}${date?`?date=${date}`:""}`,"GET",undefined,signal);
  setData(value);setDirty(false);setStale(false);return value;
 },[base,date]);
 useEffect(()=>{const controller=new AbortController();setBusy(true);setData(null);setError("");setNotice("");setDirty(false);
  void load(controller.signal).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});
  return ()=>controller.abort();
 },[load]);
 useEffect(()=>{if(!dirty)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue="";};window.addEventListener("beforeunload",warn);return ()=>window.removeEventListener("beforeunload",warn);},[dirty]);
 function discard(){return !dirty||window.confirm("Discard your unsaved attendance changes?");}
 async function reload(){if(!discard())return;setBusy(true);setError("");setNotice("");try{await load();}catch(e){setData(null);setError(e instanceof Error?e.message:"Attendance could not be loaded.");}finally{setBusy(false);}}
 async function save(){
  if(!data||busy||stale||!dirty)return;setBusy(true);setError("");setNotice("");
  try{
   await request(base,"PUT",{date:data.date,revision:data.revision,reason:data.revision===0?"INITIAL_REGISTER":reason,entries:data.learners.map(({personId,status})=>({personId,status}))});
   setDirty(false);setStale(true);
   try{const saved=await load();setNotice(`Attendance saved for ${saved.date}. Revision ${saved.revision}.`);}catch{setNotice("Attendance was saved. Reload to view the confirmed register before making further changes.");}
  }catch(e){setError(e instanceof Error?e.message:"The save result could not be confirmed. Reload before retrying.");setStale(true);}finally{setBusy(false);}
 }
 const locked=busy||stale;const counts=Object.fromEntries(statuses.map(status=>[status,data?.learners.filter(r=>r.status===status).length??0]));
 return <main className={styles.page}><header className={styles.topbar}><a className={styles.brand} href={`/dashboard?class=${classId}`}>SpaceCase <span>Teacher workspace</span></a><form action="/auth/logout" method="post"><button className={styles.secondary}>Sign out</button></form></header><div className={styles.content}>
  <p><a href={`/classes/${schoolId}/${classId}`}>Back to class roster</a></p><h1>{data?`${data.class.name} attendance`:"Class attendance"}</h1>
<TeacherGuide topic="attendance"/>
  <p>Record daily attendance for your currently enrolled learners. Unmarked learners are never assumed absent. Earlier dates show the current class list, rather than a historical enrolment list.</p>
  {error?<p className={styles.error} role="alert">{error}</p>:null}{notice?<p className={styles.notice} role="status">{notice}</p>:null}
  <section className={styles.card}><h2>Daily register</h2><div className={styles.actions}><label className={styles.field}>Attendance date<input type="date" value={date||data?.date||""} max={data?.today} min="1900-01-01" disabled={busy} onChange={e=>{if(e.target.value&&discard())setDate(e.target.value);}}/></label><button className={styles.secondary} disabled={busy} onClick={()=>void reload()}>Reload register</button></div>
   {busy&&!data?<p role="status">Checking your class access and loading attendance…</p>:null}
   {data?<><p>School timezone: {data.timezone}. {data.revision?`Saved revision ${data.revision}.`:"No register saved for this date yet."}</p>
    {dirty?<p role="status">You have unsaved changes.</p>:null}{stale?<p role="status">Reload the register before making further changes.</p>:null}
    {!data.learners.length?<p>No current learners are enrolled in this class. Ask your administrator to enrol learners first.</p>:<>
     <p>{dirty?"Draft counts":"Register counts"}: {statuses.map(status=>`${label[status]} ${counts[status]}`).join(" · ")}</p>
     <button type="button" className={styles.secondary} disabled={locked||!counts.UNMARKED} onClick={()=>{setData({...data,learners:data.learners.map(r=>r.status==="UNMARKED"?{...r,status:"PRESENT"}:r)});setDirty(true);setNotice("");}}>Mark unmarked learners as present</button>
     <div className={styles.tableWrap}><table><thead><tr><th>School reference</th><th>Learner</th><th>Attendance</th></tr></thead><tbody>{data.learners.map(learner=><tr key={learner.personId}><td>{learner.admissionNumber}</td><td>{learner.givenName} {learner.familyName}</td><td><select aria-label={`Attendance for ${learner.givenName} ${learner.familyName} (${learner.admissionNumber})`} value={learner.status} disabled={locked} onChange={e=>{const status=e.target.value as AttendanceStatus;setData({...data,learners:data.learners.map(r=>r.personId===learner.personId?{...r,status}:r)});setDirty(true);setNotice("");}}>{statuses.map(status=><option key={status} value={status}>{label[status]}</option>)}</select></td></tr>)}</tbody></table></div>
     {data.revision>0?<label className={styles.field}>Reason for updating this register<select value={reason} disabled={locked} onChange={e=>setReason(e.target.value as typeof reason)}><option value="CORRECTION">Correct an attendance mark</option><option value="LATE_UPDATE">Update a late arrival</option><option value="ROSTER_UPDATE">Update after a class list change</option></select></label>:null}
     <p className={styles.note}>Review the marks before saving. Changes are recorded with your account, date and reason. This does not send messages to parents.</p>
     <button className={styles.primary} disabled={locked||!dirty} onClick={()=>void save()}>{busy?"Saving…":"Save attendance"}</button>
    </>}
   </>:!busy?<p>No attendance records are shown. Reload the register to try again.</p>:null}
  </section>
 </div></main>;
}
