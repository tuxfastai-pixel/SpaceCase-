"use client";
import {useEffect,useState} from "react";
import {homeworkInput,type Task,type TaskFields,type CompletionStatus} from "../../domains/homework/contracts";
import type {AttendanceRoster} from "../../domains/attendance/contracts";
import TeacherGuide from "../teacher-help/TeacherGuide";
import styles from "../planner/planner.module.css";
type Summary=Pick<Task,"id"|"title"|"subject"|"assignedDate"|"dueDate"|"state"|"revision">;
type List={tasks:Summary[];nextOffset:number|null;className:string;timezone:string;today:string};
type Detail={history:Array<{revision:number;action:string;occurredAt:string;reason:string|null;changeCount:number}>;task:Task;roster:AttendanceRoster;className:string;timezone:string;today:string};
const messages:Record<string,string>={TASK_CHANGED:"This task changed in another window. Reload it before saving again.",ROSTER_CHANGED:"The class roster changed. Reload the task and check the current learners.",CLASS_ACCESS_REQUIRED:"Your current teacher assignment does not allow access to this class.",UNAUTHENTICATED:"Your session has ended. Sign in again.",CLASS_WORKSPACE_REQUIRED:"The school administrator needs to activate this class workspace.",CORRECTION_REASON_REQUIRED:"Choose correction or follow-up when changing a previously recorded outcome."};
export default function HomeworkClient({schoolId,classId}:{schoolId:string;classId:string}){
 const [list,setList]=useState<List|null>(null),[detail,setDetail]=useState<Detail|null>(null),[fields,setFields]=useState<TaskFields|null>(null),[entries,setEntries]=useState<Record<string,CompletionStatus>>({}),[reason,setReason]=useState("INITIAL_RECORD"),[busy,setBusy]=useState(false),[dirty,setDirty]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [draftId,setDraftId]=useState("");
 const base=`/api/v1/schools/${schoolId}/classes/${classId}/homework`;
 async function request(url:string,body?:unknown){const r=await fetch(url,{method:body?"POST":"GET",signal:AbortSignal.timeout(30000),redirect:"error",cache:"no-store",headers:body?{"content-type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined});const v=await r.json();if(!r.ok)throw new Error(messages[v.error]??"The request could not be confirmed. Reload the saved task before trying again.");return v;}
 useEffect(()=>{let active=true;fetch(base,{cache:"no-store",signal:AbortSignal.timeout(15000)}).then(async r=>{const v=await r.json();if(!r.ok)throw new Error(messages[v.error]??"Homework is temporarily unavailable.");if(active)setList(v);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[base]);
 useEffect(()=>{if(!dirty)return;const leave=(e:BeforeUnloadEvent)=>{e.preventDefault();};window.addEventListener("beforeunload",leave);return()=>window.removeEventListener("beforeunload",leave);},[dirty]);
 function discard(){return !dirty||window.confirm("Discard your unsaved homework changes?");}
 function hydrate(v:Detail){setDetail(v);setFields({title:v.task.title,subject:v.task.subject,instructions:v.task.instructions,assignedDate:v.task.assignedDate,dueDate:v.task.dueDate});setEntries(Object.fromEntries(v.roster.learners.map(l=>[l.personId,v.task.completions[l.personId]??"PENDING"])));setReason(Object.keys(v.task.completions).length?"CORRECTION":"INITIAL_RECORD");setDirty(false);}
 async function open(id:string){if(!discard())return;setBusy(true);setError("");setNotice("");try{hydrate(await request(`${base}?task=${id}`));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function refresh(){if(!discard())return;setBusy(true);try{setList(await request(base));setDetail(null);setFields(null);setDirty(false);setError("");}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 function create(){if(!list||!discard())return;setDraftId(crypto.randomUUID());setDetail(null);setFields({title:"",subject:"",instructions:"",assignedDate:list.today,dueDate:list.today});setDirty(false);setError("");setNotice("");}
 function change(key:keyof TaskFields,value:string){setFields(f=>f?{...f,[key]:value}:f);setDirty(true);}
 async function save(action:string){
  setError("");setNotice("");const task=detail?.task;
  const value=action==="CREATE"?{action,taskId:draftId,fields}:action==="EDIT"?{action,taskId:task?.id,revision:task?.revision,fields}:action==="COMPLETIONS"?{action,taskId:task?.id,revision:task?.revision,reason,entries:Object.entries(entries).map(([personId,status])=>({personId,status}))}:{action,taskId:task?.id,revision:task?.revision};
  const parsed=homeworkInput.safeParse(value);if(!parsed.success){setError(parsed.error.issues[0]?.message??"Check the task fields.");return;}
  setBusy(true);try{const saved=await request(base,parsed.data);hydrate(await request(`${base}?task=${saved.taskId}`));setList(await request(base));setNotice(action==="ASSIGN"?"Task assigned in your workspace. No email or family notification was sent.":"Homework saved.");}catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <main className={styles.page}><header className={styles.header}><div><p className={styles.eyebrow}>SpaceCase · Teaching</p><h1>Homework</h1><p>{list?.className??"Assigned class"}</p></div><a href={`/dashboard?class=${classId}`} onClick={e=>{if(!discard())e.preventDefault();}}>Teacher workspace</a></header>
 <TeacherGuide topic="homework"/>
 <p className={styles.intro}>Plan tasks and record completion for your current learners. Tasks are private to your teacher workspace. Assigning a task records it here; share instructions through your school’s usual channels. Automatic email and family notifications are not connected.</p>
 {list?<p className={styles.hint}>Dates follow {list.timezone}. Today: {list.today}. Overdue means the due date has passed; it does not automatically mark a learner incomplete.</p>:null}
 {error?<p role="alert" className={styles.error}>{error}</p>:null}{notice?<p role="status" className={styles.notice}>{notice}</p>:null}
 <div className={styles.actions}><button disabled={busy||!list} onClick={create}>New homework</button><button disabled={busy} onClick={refresh}>Reload saved homework</button></div>
 {fields?<section className={styles.lesson}><h2>{detail?detail.task.title:"New homework"}</h2>{detail?<p>Status: {detail.task.state.toLowerCase()} · Revision {detail.task.revision}</p>:null}
 <fieldset disabled={busy||Boolean(detail&&detail.task.state!=="DRAFT")} className={styles.editor}><div className={styles.grid}>
 <label>Title<input maxLength={160} value={fields.title} onChange={e=>change("title",e.target.value)}/></label><label>Subject<input maxLength={80} value={fields.subject} onChange={e=>change("subject",e.target.value)}/></label>
 <label>Assigned date<input type="date" min="1900-01-01" max="2200-12-31" value={fields.assignedDate} onChange={e=>change("assignedDate",e.target.value)}/></label><label>Due date<input type="date" min={fields.assignedDate} max="2200-12-31" value={fields.dueDate} onChange={e=>change("dueDate",e.target.value)}/></label></div>
 <label>Instructions<textarea rows={6} maxLength={8000} value={fields.instructions} onChange={e=>change("instructions",e.target.value)}/></label></fieldset>
 {detail&&detail.task.state!=="DRAFT"?<p className={styles.hint}>Instructions are fixed once assigned, so recorded completion always refers to the same work. Create a new task for revised instructions.</p>:null}
 <div className={styles.actions}>{!detail||detail.task.state==="DRAFT"?<button className={styles.primary} disabled={busy} onClick={()=>save(detail?"EDIT":"CREATE")}>Save draft</button>:null}
 {detail?.task.state==="DRAFT"?<button disabled={busy||dirty} onClick={()=>save("ASSIGN")}>Assign task</button>:null}
 {detail?.task.state==="ASSIGNED"?<button disabled={busy||dirty} onClick={()=>save("CLOSE")}>Close task</button>:null}
 {detail?.task.state==="CLOSED"?<button disabled={busy} onClick={()=>save("REOPEN")}>Reopen for corrections</button>:null}</div>
 {dirty?<p className={styles.hint}>Unsaved changes. Save before assigning, closing or opening another task.</p>:null}
 {detail&&detail.task.state!=="DRAFT"?<section><h3>Completion register</h3><p className={styles.hint}>Pending means no outcome recorded. This register does not award assessment marks. Closed tasks keep their records; reopen to make an audited correction.</p>
 {!detail.roster.learners.length?<p>No learners are currently enrolled in this class.</p>:null}
 <fieldset className={styles.editor} disabled={busy||detail.task.state!=="ASSIGNED"}>{detail.roster.learners.map(l=><label key={l.personId}>{l.givenName} {l.familyName} · {l.admissionNumber}<select value={entries[l.personId]??"PENDING"} onChange={e=>{setEntries(v=>({...v,[l.personId]:e.target.value as CompletionStatus}));setDirty(true);}}>{["PENDING","COMPLETED","INCOMPLETE","EXCUSED"].map(s=><option key={s} value={s}>{s.toLowerCase()}</option>)}</select></label>)}
 <label>Reason for this update<select value={reason} onChange={e=>setReason(e.target.value)}><option value="INITIAL_RECORD">Initial record</option><option value="CORRECTION">Correction</option><option value="FOLLOW_UP">Follow-up</option></select></label><button className={styles.primary} disabled={!detail.roster.learners.length||!dirty} onClick={()=>save("COMPLETIONS")}>Save completion register</button></fieldset></section>:null}
 {detail?<section><h3>Recent update history</h3><p className={styles.hint}>Latest 50 saved revisions. Each completion change keeps its previous outcome in the audit record.</p><ul>{detail.history.map(e=><li key={e.revision}>Revision {e.revision} · {e.action.toLowerCase()} · {new Date(e.occurredAt).toLocaleString()}{e.reason?` · ${e.reason.toLowerCase()} · ${e.changeCount} changed`:""}</li>)}</ul></section>:null}</section>:null}
 <section><h2>Saved tasks</h2>{!list?<p>Loading homework…</p>:!list.tasks.length?<p>No homework yet. Create your first draft.</p>:list.tasks.map(t=><article className={styles.lesson} key={t.id}><h3>{t.title}</h3><p>{t.subject} · Due {t.dueDate} · {t.state.toLowerCase()}{t.state==="ASSIGNED"&&t.dueDate<list.today?" · Overdue":""}</p><button disabled={busy} onClick={()=>open(t.id)}>Open task</button></article>)}
 {list?.nextOffset!==null&&list?.nextOffset!==undefined?<button disabled={busy} onClick={async()=>{setBusy(true);try{const more:List=await request(`${base}?offset=${list.nextOffset}`);setList({...more,tasks:[...list.tasks,...more.tasks]});}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>Load older tasks</button>:null}</section></main>;
}
