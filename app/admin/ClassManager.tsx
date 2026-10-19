"use client";
import { useEffect,useState } from "react";
import styles from "./admin.module.css";
type Classroom={id:string;name:string;academicYear:number|null};
type Teacher={personId:string;email:string|null};
type Directory={classes:Classroom[];teachers:Teacher[];assignments:Array<{classId:string;teacherPersonId:string}>};
const errorText:Record<string,string>={CLASS_ALREADY_EXISTS:"A class with this name already exists for that year.",CLASS_UNAVAILABLE:"That class is no longer available.",ACTIVE_SCHOOL_TEACHER_REQUIRED:"Choose an active teacher who has joined this school.",SCHOOL_ADMIN_REQUIRED:"You no longer have administrator access to this school.",ASSIGNMENT_UNAVAILABLE:"That assignment has already ended. Refresh the list.",INVALID_INPUT:"Check the class name and academic year.",UNAUTHENTICATED:"Please sign in again."};
async function request<T>(url:string,method="GET",body?:unknown,signal?:AbortSignal):Promise<T>{
  const response=await fetch(url,{method,headers:{"content-type":"application/json"},body:body===undefined?undefined:JSON.stringify(body),cache:"no-store",credentials:"same-origin",signal});
  const data=await response.json();
  if(!response.ok) throw new Error(errorText[data.error]??"We couldn’t update classes. Please try again.");
  return data;
}
const teacherLabel=(t:Teacher|undefined)=>t?(t.email??`Teacher ID ${t.personId.slice(-8)}`):"Teacher unavailable";
export default function ClassManager({schoolId}:{schoolId:string}){
  const [data,setData]=useState<Directory|null>(null);
  const [name,setName]=useState("");const [year,setYear]=useState(new Date().getFullYear());
  const [classId,setClassId]=useState("");const [teacherId,setTeacherId]=useState("");
  const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [notice,setNotice]=useState("");
  const base=`/api/v1/admin/schools/${schoolId}/classes`;
  useEffect(()=>{const controller=new AbortController();
    void request<Directory>(base,"GET",undefined,controller.signal).then(setData).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
    return ()=>controller.abort();
  },[base]);
  async function action(run:()=>Promise<void>){setBusy(true);setError("");setNotice("");try{await run();setData(await request<Directory>(base));}catch(e){setError(e instanceof Error?e.message:"Please try again.");}finally{setBusy(false);}}
  return <section className={styles.card} aria-labelledby="class-manager-heading">
    <p className={styles.eyebrow}>Classroom setup</p><h2 id="class-manager-heading">Classes and teachers</h2>
    <p>Create your school’s real classes, then assign teachers who have accepted their invitations. Assignments control access to the learners enrolled in each class.</p>
    {error?<p className={styles.error} role="alert">{error}</p>:null}{notice?<p className={styles.notice} role="status">{notice}</p>:null}
    {data===null?<p>Loading classes…</p>:<>
      <div className={styles.grid}>
        <form onSubmit={e=>{e.preventDefault();void action(async()=>{const result=await request<{class:Classroom}>(base,"POST",{name,academicYear:year});setClassId(result.class.id);setName("");setNotice("Class created. You can now assign a teacher.");});}}>
          <label className={styles.field}>Class name<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Grade 2C" disabled={busy}/></label>
          <label className={styles.field}>Academic year<input required type="number" min={1900} max={2200} value={year} onChange={e=>setYear(Number(e.target.value))} disabled={busy}/></label>
          <button className={styles.primary} disabled={busy}>Create class</button>
        </form>
        <form onSubmit={e=>{e.preventDefault();void action(async()=>{await request(`${base}/${classId}/teachers`,"POST",{teacherPersonId:teacherId});setNotice("Teacher assigned. They can refresh their workspace to see this class.");});}}>
          <label className={styles.field}>Class<select required value={classId} onChange={e=>setClassId(e.target.value)} disabled={busy}><option value="">Choose a class</option>{data.classes.map(c=><option key={c.id} value={c.id}>{c.name}{c.academicYear?` · ${c.academicYear}`:""}</option>)}</select></label>
          <label className={styles.field}>Teacher<select required value={teacherId} onChange={e=>setTeacherId(e.target.value)} disabled={busy}><option value="">Choose a teacher</option>{data.teachers.map(t=><option key={t.personId} value={t.personId}>{teacherLabel(t)}</option>)}</select></label>
          <button className={styles.primary} disabled={busy||!data.classes.length||!data.teachers.length}>Assign teacher</button>
          {!data.teachers.length?<p className={styles.note}>No active teachers have joined yet. Invite someone with Teacher access first.</p>:null}
        </form>
      </div>
      {!data.classes.length?<p>No classes yet. Add your first class above.</p>:<div className={styles.tableWrap}><table><thead><tr><th>Class</th><th>Year</th><th>Teachers</th></tr></thead><tbody>{data.classes.map(c=><tr key={c.id}><td>{c.name}<p><a href={`/admin/learners/${schoolId}/${c.id}`}>Manage learners</a></p></td><td>{c.academicYear??"Not set"}</td><td>{data.assignments.filter(a=>a.classId===c.id).length===0?"Not assigned":data.assignments.filter(a=>a.classId===c.id).map(a=><div className={styles.actions} key={a.teacherPersonId}><span>{teacherLabel(data.teachers.find(t=>t.personId===a.teacherPersonId)!)}</span><button className={styles.secondary} disabled={busy} onClick={()=>{if(!window.confirm(`Remove this teacher’s access to ${c.name}?`))return;void action(async()=>{await request(`${base}/${c.id}/teachers/${a.teacherPersonId}`,"DELETE");setNotice("Class assignment removed.");});}}>Remove assignment</button></div>)}</td></tr>)}</tbody></table></div>}
      <p className={styles.note}>Only this school’s active teachers are listed. Use Manage learners to register learners, import a class list and review enrolment. Showing up to 200 classes and teachers.</p>
    </>}
  </section>;
}
