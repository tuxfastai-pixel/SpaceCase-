"use client";
import {useEffect,useState} from "react";
import styles from "./admin.module.css";
type State={storageReady:boolean;workspace:{timezone:string|null;academicYearLabel:string|null}|null};
export default function WorkspaceSetup({schoolId}:{schoolId:string}){
  const [data,setData]=useState<State|null>(null);const [error,setError]=useState("");const [notice,setNotice]=useState("");const [busy,setBusy]=useState(false);
  const [timezone,setTimezone]=useState("Africa/Johannesburg");const [year,setYear]=useState(String(new Date().getFullYear()));
  const url=`/api/v1/admin/schools/${schoolId}/workspace`;
  useEffect(()=>{const controller=new AbortController();
    void fetch(url,{cache:"no-store",signal:controller.signal}).then(async r=>{if(!r.ok)throw new Error(r.status===401||r.status===403?"Administrator access is required.":"Learning storage is not ready. Your administrator can still manage invitations, classes and enrolment below.");return r.json() as Promise<State>;})
      .then(value=>{setData(value);if(value.workspace?.timezone)setTimezone(value.workspace.timezone);if(value.workspace?.academicYearLabel)setYear(value.workspace.academicYearLabel);})
      .catch(e=>{if(!controller.signal.aborted)setError(e.message);});return ()=>controller.abort();
  },[url]);
  return <section className={styles.card}><p className={styles.eyebrow}>Workspace readiness</p><h2>School learning workspace</h2>
    <p>Set the school timezone and academic year, and connect its current classes to the learning workspace. Learner enrolment remains available through PEOS while learning storage is being configured.</p>
    {error?<p className={styles.error} role="alert">{error}</p>:null}{notice?<p className={styles.notice} role="status">{notice}</p>:null}
    {data?<><p>{data.workspace?"Workspace configured. Save again after adding classes to include them.":"Storage connection confirmed. Complete the workspace settings."}</p>
      <form onSubmit={e=>{e.preventDefault();if(busy)return;setBusy(true);setError("");setNotice("");
        void fetch(url,{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({timezone,academicYearLabel:year})})
          .then(async r=>{if(!r.ok)throw new Error(r.status===400?"Check the timezone and academic year.":"Workspace settings could not be confirmed. Refresh before retrying.");setData({storageReady:true,workspace:{timezone,academicYearLabel:year}});setNotice("Workspace settings saved and current classes connected.");})
          .catch(e=>setError(e.message)).finally(()=>setBusy(false));
      }}><div className={styles.grid}><label className={styles.field}>Timezone<input required maxLength={80} value={timezone} disabled={busy} onChange={e=>setTimezone(e.target.value)}/></label><label className={styles.field}>Academic year label<input required maxLength={40} value={year} disabled={busy} onChange={e=>setYear(e.target.value)}/></label></div><button className={styles.primary} disabled={busy}>Save workspace settings</button></form></>:!error?<p>Checking learning storage…</p>:null}
  </section>;
}
