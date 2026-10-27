"use client";
import {useEffect,useState} from "react";
import {teacherDaySchema,type TeacherDay} from "../../domains/teacher-day/contracts";
import {classPath} from "./workspaceModel";
import styles from "./dashboard.module.css";
import WorkspaceIcon from "../ui/WorkspaceIcon";
type State={status:"loading"}|{status:"ready";day:TeacherDay}|{status:"error";message:string};
export function DayContent({day,schoolId,classId}:{day:TeacherDay;schoolId:string;classId:string}){
 const href=(tool:string)=>classPath(schoolId,classId,tool);
 const due=day.homework.overdue+day.homework.dueToday;
 const followUps=day.followUps.overdue+day.followUps.dueToday;
 return <><div className={styles.dayDate}><strong>{new Intl.DateTimeFormat("en-ZA",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(`${day.date}T12:00:00Z`))}</strong><span>{day.timezone}</span></div>
 <div className={styles.dayMetrics}>
 <a href={href("attendance")} className={styles.metric}><span><WorkspaceIcon name="attendance"/> Attendance recorded</span><strong>{day.attendance.marked}<small> / {day.attendance.rosterCount}</small></strong><p>{day.attendance.rosterCount===0?"No current learners":day.attendance.unmarked?`${day.attendance.unmarked} still unmarked`:"All current learners recorded"}{day.attendance.saved?" · Saved register":""}</p></a>
 <a href={href("homework")} className={styles.metric}><span><WorkspaceIcon name="homework"/> Homework due</span><strong>{due}<small> tasks</small></strong><p>{day.homework.overdue} overdue · {day.homework.dueToday} due today</p></a>
 <a href={href("assessments")} className={styles.metric}><span><WorkspaceIcon name="assessment"/> Work to review</span><strong>{day.assessments.awaitingReview}<small> submissions</small></strong><p>Uploaded work without approved marks · {day.assessments.unmatchedPhotos} photos to match</p></a>
 <a href={href("observations")} className={styles.metric}><span><WorkspaceIcon name="observations"/> Follow-ups due</span><strong>{followUps}</strong><p>{day.followUps.overdue} overdue · {day.followUps.dueToday} due today</p></a>
 </div>
 <div className={styles.dayColumns}><section className={styles.dayCard}><div className={styles.dayCardHeading}><h3>Today’s lessons</h3><a href={href("planner")}>Open planner</a></div>{day.lessons.total===0?<p className={styles.subtle}>No lessons saved for today. Add them in your weekly planner.</p>:<><ul className={styles.agendaList}>{day.lessons.items.map(l=><li key={l.id}><div><strong>{l.subject}</strong><span>{l.topic}</span></div><span className={styles.pill}>{l.status.toLowerCase()}</span></li>)}</ul>{day.lessons.total>day.lessons.items.length?<p className={styles.subtle}>Showing {day.lessons.items.length} of {day.lessons.total} lessons. Open the planner for all.</p>:null}</>}</section>
 <section className={styles.dayCard}><div className={styles.dayCardHeading}><h3>Homework ahead</h3><a href={href("homework")}>Open homework</a></div>{day.homework.items.length===0?<p className={styles.subtle}>No overdue homework or assigned tasks due in the next seven days.</p>:<><ul className={styles.agendaList}>{day.homework.items.map(t=><li key={t.id}><div><strong>{t.title}</strong><span>{t.subject} · Due {t.dueDate}</span></div><span className={styles.pill}>{t.dueDate<day.date?"Overdue":t.dueDate===day.date?"Today":"Upcoming"}</span></li>)}</ul>{day.homework.overdue+day.homework.dueToday+day.homework.upcoming>day.homework.items.length?<p className={styles.subtle}>Showing the five earliest due tasks. Open homework for all.</p>:null}</>}</section></div>
 <p className={styles.subtle}>This overview shows saved work for this class. It does not mark missing attendance, grade work or send reminders.</p></>;
}
export default function DayOverview({schoolId,classId}:{schoolId:string;classId:string}){
 const [state,setState]=useState<State>({status:"loading"}),[reload,setReload]=useState(0);
 useEffect(()=>{const controller=new AbortController();let active=true;const timer=setTimeout(()=>controller.abort(),30000);
  fetch(`/api/v1/schools/${schoolId}/classes/${classId}/day`,{cache:"no-store",credentials:"same-origin",signal:controller.signal}).then(async r=>{const v=await r.json();if(!r.ok)throw new Error(r.status===401?"Your session has ended. Sign in again.":r.status===403?"Your class access changed. Reload your workspace to check your current assignments.":"The daily overview is unavailable. Your class tools are still available below.");const day=teacherDaySchema.parse(v);if(active)setState({status:"ready",day});}).catch(e=>{if(active)setState({status:"error",message:e instanceof Error&&e.name!=="ZodError"&&e.name!=="AbortError"?e.message:"The daily overview could not be loaded. Your class tools are still available below."});}).finally(()=>clearTimeout(timer));
  return()=>{active=false;controller.abort();clearTimeout(timer);};
 },[schoolId,classId,reload]);
 return <section className={styles.section} aria-labelledby="day-heading"><div className={styles.sectionHeader}><div><p className={styles.eyebrow}>Your teaching day</p><h2 id="day-heading">Today at a glance</h2></div><button type="button" className={styles.secondaryButton} disabled={state.status==="loading"} onClick={()=>{setState({status:"loading"});setReload(v=>v+1);}}>Refresh overview</button></div>
 {state.status==="loading"?<p role="status" className={styles.emptyState}>Loading today’s saved work…</p>:state.status==="error"?<div role="status" className={styles.setupNotice}><p>{state.message}</p><a href="/login">Sign in</a><span> · </span><a href={`/dashboard?class=${classId}`}>Reload workspace</a></div>:<DayContent day={state.day} schoolId={schoolId} classId={classId}/>}</section>;
}
