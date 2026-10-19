"use client";
import {useEffect,useState} from "react";
import {learnerSchema,parseLearnerCsv,reviewLearners,type LearnerInput,type LearnerReview} from "../../platform/learners/import";
import styles from "../admin/admin.module.css";
type Learner=LearnerInput&{personId:string};
type Roster={class:{id:string;name:string;academicYear:number|null};learners:Learner[];nextOffset:number|null};
type Result={admissionNumber:string;status:"CREATED"|"ENROLLED"|"ALREADY_ENROLLED"|"CONFLICT"};
const labels:Record<Result["status"],string>={CREATED:"Learner registered and enrolled",ENROLLED:"Existing learner enrolled",ALREADY_ENROLLED:"Already enrolled",CONFLICT:"Reference conflict: check the existing record; no changes made for this row"};
const messages:Record<string,string>={CLASS_TEACHER_REQUIRED:"You no longer have access to this class.",SCHOOL_ADMIN_REQUIRED:"Administrator access is required.",CLASS_UNAVAILABLE:"This class is unavailable.",INVALID_INPUT:"Check the references and names. Each reference must be unique in the batch.",UNAUTHENTICATED:"Please sign in again.",ENROLMENT_UNAVAILABLE:"This enrolment has ended. Refresh the roster."};
async function api<T>(url:string,method="GET",body?:unknown,signal?:AbortSignal){
 const r=await fetch(url,{method,body:body===undefined?undefined:JSON.stringify(body),headers:{"content-type":"application/json"},credentials:"same-origin",cache:"no-store",signal});
 const value=await r.json();if(!r.ok)throw new Error(messages[value.error]??"The result could not be confirmed. Refresh the roster before retrying.");return value as T;
}
function template(){const url=URL.createObjectURL(new Blob(["admission_number,given_name,family_name\r\n"],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="spacecase-learners-template.csv";a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
export default function RosterClient({schoolId,classId,admin}:{schoolId:string;classId:string;admin:boolean}){
 const base=admin?`/api/v1/admin/schools/${schoolId}/classes/${classId}/learners`:`/api/v1/schools/${schoolId}/classes/${classId}/roster`;
 const [data,setData]=useState<Roster|null>(null);const [offset,setOffset]=useState(0);const [error,setError]=useState("");const [notice,setNotice]=useState("");const [busy,setBusy]=useState(false);
 const [input,setInput]=useState<LearnerInput>({admissionNumber:"",givenName:"",familyName:""});const [csv,setCsv]=useState("");const [rows,setRows]=useState<LearnerReview[]|null>(null);const [results,setResults]=useState<Result[]|null>(null);const [reading,setReading]=useState(false);
 const reviewed=reviewLearners(rows??[]);const chosen=reviewed.filter(r=>r.selected&&!r.issue);const locked=busy||reading;
 useEffect(()=>{const controller=new AbortController();setData(null);setError("");
  void api<Roster>(`${base}?offset=${offset}`,"GET",undefined,controller.signal).then(setData).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return ()=>controller.abort();
 },[base,offset]);
 async function reload(){setData(await api<Roster>(`${base}?offset=${offset}`));}
 async function save(learners:LearnerInput[]){
  if(locked||!learners.length)return;setBusy(true);setError("");setNotice("");setResults(null);
  try{const result=await api<{results:Result[]}>(base,"POST",{learners});setResults(result.results);setInput({admissionNumber:"",givenName:"",familyName:""});setRows(null);setCsv("");
    try{await reload();}catch{setNotice("Enrolment results are shown. Refresh to update the roster.");}
  }catch(e){setError(e instanceof Error?e.message:"Refresh the roster before retrying.");}finally{setBusy(false);}
 }
 function edit(index:number,patch:Partial<LearnerReview>){setRows(current=>current?.map((r,i)=>i===index?{...r,...patch}:r)??null);}
 return <main className={styles.page}><header className={styles.topbar}><a className={styles.brand} href={admin?"/admin":"/dashboard"}>SpaceCase <span>{admin?"School administration":"Teacher workspace"}</span></a><form action="/auth/logout" method="post"><button className={styles.secondary}>Sign out</button></form></header><div className={styles.content}>
  <p><a href={admin?"/admin":"/dashboard"}>Back to workspace</a></p><h1>{data?data.class.name:"Class roster"}</h1><p>{data?.class.academicYear??""} · {admin?"Manage learner enrolment":"Your assigned class"}</p>
  {error?<p className={styles.error} role="alert">{error}</p>:null}{notice?<p className={styles.notice} role="status">{notice}</p>:null}
  {results?<section className={styles.card} aria-live="polite"><h2>Enrolment results</h2><ul>{results.map(r=><li key={r.admissionNumber}><strong>{r.admissionNumber}</strong>: {labels[r.status]}</li>)}</ul></section>:null}
  {admin&&data?<section className={styles.card}><h2>Add a learner</h2><p>Use the learner’s school-issued reference, given name and family name. References are unique within this school. Matching an existing reference requires matching names; it never overwrites them. No learner login is created.</p>
    <form onSubmit={e=>{e.preventDefault();const parsed=learnerSchema.safeParse(input);if(!parsed.success){setError("Check the learner reference and both names.");return;}void save([parsed.data]);}}>
      <div className={styles.grid}><label className={styles.field}>School learner reference<input required maxLength={40} value={input.admissionNumber} disabled={locked} onChange={e=>setInput({...input,admissionNumber:e.target.value})}/></label><div><label className={styles.field}>Given name<input required maxLength={80} value={input.givenName} disabled={locked} onChange={e=>setInput({...input,givenName:e.target.value})}/></label><label className={styles.field}>Family name<input required maxLength={80} value={input.familyName} disabled={locked} onChange={e=>setInput({...input,familyName:e.target.value})}/></label></div></div><button className={styles.primary} disabled={locked}>Register and enrol learner</button>
    </form>
  </section>:null}
  {admin&&data?<section className={styles.card}><h2>Import a class list</h2><p>Import up to 50 learners at a time. Only school references and names are needed. Review the file here before submitting.</p>
    {rows===null?<><button className={styles.secondary} disabled={locked} onClick={template}>Download CSV template</button><label className={styles.field}>Upload CSV (maximum 64 KB)<input type="file" accept=".csv,text/csv" disabled={locked} onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(!file)return;if(file.size>65536){setError("Use a CSV smaller than 64 KB.");return;}setReading(true);void file.text().then(s=>{setCsv(s);setError("");}).catch(()=>setError("Could not read that CSV.")).finally(()=>setReading(false));}}/></label><label className={styles.field}>Or paste CSV<textarea rows={5} maxLength={65536} value={csv} disabled={locked} onChange={e=>setCsv(e.target.value)} placeholder="admission_number,given_name,family_name"/></label><button className={styles.primary} disabled={locked||!csv.trim()} onClick={()=>{try{setRows(parseLearnerCsv(csv));setError("");setResults(null);}catch(e){setError(e instanceof Error?e.message:"Check the CSV.");}}}>Review learners</button></>:<>
      <p>{chosen.length} selected. Correct or exclude rows before adding them to <strong>{data.class.name}</strong>.</p>
      <div className={styles.tableWrap}><table><thead><tr><th>Include</th><th>Reference</th><th>Given name</th><th>Family name</th><th>Review</th></tr></thead><tbody>{reviewed.map((r,i)=><tr key={i}><td><input type="checkbox" aria-label={`Include learner row ${i+1}`} checked={r.selected&&!r.issue} disabled={locked||Boolean(r.issue)} onChange={e=>edit(i,{selected:e.target.checked})}/></td>{(["admissionNumber","givenName","familyName"] as const).map(key=><td key={key}><input aria-label={`${key} row ${i+1}`} value={rows[i][key]} maxLength={key==="admissionNumber"?40:80} disabled={locked} onChange={e=>edit(i,{[key]:e.target.value})}/></td>)}<td>{r.issue??(r.selected?"Ready":"Excluded")}</td></tr>)}</tbody></table></div>
      <div className={styles.actions}><button className={styles.primary} disabled={locked||!chosen.length} onClick={()=>void save(chosen.map(({admissionNumber,givenName,familyName})=>({admissionNumber,givenName,familyName})))}>Enrol {chosen.length} learners</button><button className={styles.secondary} disabled={locked} onClick={()=>setRows(null)}>Back to input</button></div>
    </>}
    <p className={styles.note}>This matches learners only by reference within this school. Cross-school transfers and identity merging require a separate reviewed process.</p>
  </section>:null}
  <section className={styles.card}><h2>Enrolled learners</h2>{!data?<p>{error?"No learner records are shown.":"Loading roster…"}</p>:<>
    {!data.learners.length?<p>No learners are enrolled on this page.</p>:<div className={styles.tableWrap}><table><thead><tr><th>School reference</th><th>Given name</th><th>Family name</th>{admin?<th>Action</th>:null}</tr></thead><tbody>{data.learners.map(r=><tr key={r.personId}><td>{r.admissionNumber}</td><td>{r.givenName}</td><td>{r.familyName}</td>{admin?<td><button className={styles.secondary} disabled={locked} onClick={()=>{if(!window.confirm(`Remove ${r.givenName} ${r.familyName} from this class? Their school registration and records are retained.`))return;setBusy(true);setError("");void api(`${base}/${r.personId}`,"DELETE").then(reload).catch(e=>setError(e.message)).finally(()=>setBusy(false));}}>Remove from class</button></td>:null}</tr>)}</tbody></table></div>}
    <div className={styles.actions}><button className={styles.secondary} disabled={locked||offset===0} onClick={()=>setOffset(Math.max(0,offset-100))}>Previous</button><span>Page {offset/100+1}</span><button className={styles.secondary} disabled={locked||data.nextOffset===null} onClick={()=>setOffset(data.nextOffset!)}>Next</button><button className={styles.secondary} disabled={locked} onClick={()=>{setError("");void reload().catch(e=>{setData(null);setError(e.message);});}}>Refresh roster</button></div>
  </>}
  </section>
 </div></main>;
}
