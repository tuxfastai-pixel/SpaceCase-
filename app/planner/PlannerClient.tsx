"use client";
import {useEffect,useState} from "react";
import {addDays,monday,planInput,type Lesson} from "../../domains/planner/contracts";
import styles from "./planner.module.css";
type Plan={week:string;timezone:string;className:string;revision:number;lessons:Lesson[];updatedAt:string|null};
const errors:Record<string,string>={UNAUTHENTICATED:"Your session has ended. Sign in again.",CLASS_ACCESS_REQUIRED:"You no longer have teacher access to this class.",CLASS_WORKSPACE_REQUIRED:"Ask your administrator to connect this class to the learning workspace.",PLAN_CHANGED:"This plan changed in another tab. Your edits are still here. Copy anything you need, then reload the saved plan before editing again.",INVALID_INPUT:"Check the lesson dates, subjects and topics. Ready and taught lessons also need objectives and activities."};
class RequestError extends Error{constructor(public code:string){super(errors[code]??"The planner is temporarily unavailable. Your save could not be confirmed. Reload the saved plan before trying again.");}}
async function request<T>(url:string,method="GET",body?:unknown,signal?:AbortSignal){
 const r=await fetch(url,{method,credentials:"same-origin",cache:"no-store",headers:{"content-type":"application/json"},body:body===undefined?undefined:JSON.stringify(body),signal});
 const d=await r.json();if(!r.ok)throw new RequestError(d.error);return d as T;
}
function dateLabel(value:string){return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-ZA",{weekday:"long",day:"numeric",month:"short",timeZone:"UTC"});}
export default function PlannerClient({schoolId,classId}:{schoolId:string;classId:string}){
 const base=`/api/v1/schools/${schoolId}/classes/${classId}/planner`;
 const [week,setWeek]=useState("");const [reload,setReload]=useState(0);const [data,setData]=useState<Plan|null>(null);
 const [busy,setBusy]=useState(true);const [dirty,setDirty]=useState(false);const [stale,setStale]=useState(false);const [error,setError]=useState("");const [notice,setNotice]=useState("");
 useEffect(()=>{
  const controller=new AbortController();setBusy(true);setData(null);setError("");setNotice("");setDirty(false);setStale(false);
  void request<Plan>(base+(week?`?week=${week}`:""),"GET",undefined,controller.signal).then(d=>{if(!controller.signal.aborted)setData(d);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});
  return ()=>controller.abort();
 },[base,week,reload]);
 useEffect(()=>{if(!dirty)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue="";};window.addEventListener("beforeunload",warn);return ()=>window.removeEventListener("beforeunload",warn);},[dirty]);
 function discard(){return !dirty||window.confirm("Discard your unsaved lesson-plan changes?");}
 function changeWeek(value:string){if(value&&discard())setWeek(monday(value));}
 function update(id:string,patch:Partial<Lesson>){if(!data)return;setData({...data,lessons:data.lessons.map(l=>l.id===id?{...l,...patch}:l)});setDirty(true);setNotice("");}
 function add(date:string){if(!data)return;setData({...data,lessons:[...data.lessons,{id:crypto.randomUUID(),date,subject:"",topic:"",objectives:"",activities:"",resources:"",reflection:"",status:"DRAFT"}]});setDirty(true);setNotice("");}
 async function save(){
  if(!data||busy||stale)return;const parsed=planInput.safeParse({week:data.week,revision:data.revision,lessons:data.lessons});
  if(!parsed.success){setError(parsed.error.issues[0]?.message??errors.INVALID_INPUT);return;}
  setBusy(true);setError("");setNotice("");
  try{const saved=await request<{revision:number}>(base,"PUT",parsed.data);setData({...data,lessons:parsed.data.lessons,revision:saved.revision});setDirty(false);setNotice("Your weekly plan is saved.");}
  catch(e){setStale(true);setError(e instanceof Error?e.message:"Save could not be confirmed. Reload before trying again.");}finally{setBusy(false);}
 }
 const ready=data?.lessons.filter(l=>l.status==="READY").length??0;const taught=data?.lessons.filter(l=>l.status==="TAUGHT").length??0;
 return <main className={styles.page}><header className={styles.header}><div><p className={styles.eyebrow}>SpaceCase · Teaching</p><h1>Weekly lesson planner</h1><p>{data?.className??"Your assigned class"}</p></div><a href={`/dashboard?class=${classId}`} onClick={e=>{if(!discard())e.preventDefault();}}>Teacher workspace</a></header>
 <p className={styles.intro}>Plan the week, prepare your lessons and reflect after teaching. These plans are private to your teacher account. Keep learner names and personal information out of lesson notes.</p>
 {error?<p role="alert" className={styles.error}>{error}</p>:null}{notice?<p role="status" className={styles.notice}>{notice}</p>:null}
 {busy&&!data?<p role="status">Loading your plan…</p>:null}
 {!busy&&!data?<button onClick={()=>setReload(v=>v+1)}>Try again</button>:null}
 {data?<><section className={styles.toolbar} aria-label="Week and save controls"><div><label>Week containing <input type="date" value={data.week} min="1900-01-01" max="2200-12-25" disabled={busy} onChange={e=>changeWeek(e.target.value)}/></label><p>{dateLabel(data.week)} – {dateLabel(addDays(data.week,6))} · {data.timezone}</p><div className={styles.actions}><button disabled={busy||data.week<="1900-01-08"} onClick={()=>changeWeek(addDays(data.week,-7))}>Previous week</button><button disabled={busy||data.week>="2200-12-21"} onClick={()=>changeWeek(addDays(data.week,7))}>Next week</button></div></div>
 <div><p>{data.lessons.length}/50 lessons · {ready} ready · {taught} taught</p><p aria-live="polite">{dirty?"Unsaved changes":data.revision?"All changes saved":"No saved lessons this week"}</p><div className={styles.actions}><button className={styles.primary} disabled={busy||!dirty||stale} onClick={()=>void save()}>{busy?"Saving…":"Save weekly plan"}</button><button disabled={busy} onClick={()=>{if(discard())setReload(v=>v+1);}}>Reload saved plan</button></div></div></section>
 {stale?<section className={styles.error}><p>Editing is paused until you reload the saved plan.</p><details><summary>Copy your unsaved plan before reloading</summary><label>Unsaved lesson notes<textarea readOnly rows={12} value={data.lessons.map(l=>`${l.date} · ${l.subject}: ${l.topic} (${l.status})\nObjectives: ${l.objectives}\nActivities: ${l.activities}\nResources: ${l.resources}\nReflection: ${l.reflection}`).join("\n\n")}/></label></details></section>:null}
 <fieldset className={styles.editor} disabled={busy||stale}><legend className={styles.srOnly}>Weekly lessons</legend>
 {Array.from({length:7},(_,i)=>addDays(data.week,i)).map(day=><section className={styles.day} key={day}><div className={styles.dayHead}><h2>{dateLabel(day)}</h2><button disabled={data.lessons.length>=50} onClick={()=>add(day)}>Add lesson</button></div>
 {data.lessons.filter(l=>l.date===day).length===0?<p className={styles.empty}>No lessons planned.</p>:null}
 {data.lessons.filter(l=>l.date===day).map((lesson,index)=><article key={lesson.id} className={styles.lesson}><h3>{lesson.subject&&lesson.topic?`${lesson.subject}: ${lesson.topic}`:`Lesson ${index+1}`}</h3><div className={styles.grid}>
 <label>Subject <input required maxLength={80} value={lesson.subject} onChange={e=>update(lesson.id,{subject:e.target.value})}/></label>
 <label>Topic <input required maxLength={160} value={lesson.topic} onChange={e=>update(lesson.id,{topic:e.target.value})}/></label>
 <label>Lesson date <input type="date" min={data.week} max={addDays(data.week,6)} value={lesson.date} onChange={e=>{if(e.target.value)update(lesson.id,{date:e.target.value});}}/></label>
 <label>Status <select value={lesson.status} onChange={e=>update(lesson.id,{status:e.target.value as Lesson["status"]})}><option value="DRAFT">Draft</option><option value="READY">Ready to teach</option><option value="TAUGHT">Taught</option></select></label></div>
 <label>Learning objectives <textarea rows={3} maxLength={2000} value={lesson.objectives} onChange={e=>update(lesson.id,{objectives:e.target.value})}/></label>
 <label>Activities and teaching steps <textarea rows={4} maxLength={4000} value={lesson.activities} onChange={e=>update(lesson.id,{activities:e.target.value})}/></label>
 <label>Resources and preparation <textarea rows={2} maxLength={2000} value={lesson.resources} onChange={e=>update(lesson.id,{resources:e.target.value})}/></label>
 <label>Teaching reflection <textarea rows={2} maxLength={2000} value={lesson.reflection} onChange={e=>update(lesson.id,{reflection:e.target.value})}/></label>
 <p className={styles.hint}>Ready and taught lessons need objectives and activities. Saving a plan does not send it to learners or families.</p>
 <button onClick={()=>{if(window.confirm("Remove this lesson from the plan? Save the week to confirm the removal.")){setData({...data,lessons:data.lessons.filter(l=>l.id!==lesson.id)});setDirty(true);setNotice("");}}}>Remove lesson</button>
 </article>)}</section>)}
 </fieldset></>:null}</main>;
}
