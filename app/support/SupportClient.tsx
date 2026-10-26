"use client";
import {useCallback,useEffect,useState} from "react";
import type {SupportContext} from "../../domains/support/contracts";
import {supportApi,statusLabels,showDate,type Ticket,type TicketData} from "./shared";
import TicketPanel from "./TicketPanel";
import s from "./support.module.css";
type Home={context:SupportContext;tickets:Ticket[];nextOffset:number|null};
const areas=["DASHBOARD","ATTENDANCE","ROSTER","SCHOOL_ADMIN","OTHER"] as const;
export default function SupportClient({initialArea="OTHER",initialTitle=""}:{initialArea?:string;initialTitle?:string}){
 const [home,setHome]=useState<Home|null>(null);const [offset,setOffset]=useState(0);const [selected,setSelected]=useState("");const [detail,setDetail]=useState<TicketData|null>(null);
 const [error,setError]=useState("");const [notice,setNotice]=useState("");const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);
 const [requestId,setRequestId]=useState("");const [draft,setDraft]=useState({schoolId:"",category:"BUG",impact:"DEGRADED",area:areas.some(a=>a===initialArea)?initialArea:"OTHER",title:initialTitle,description:""});
 const load=useCallback(async(signal?:AbortSignal)=>{const value=await supportApi<Home>("/api/v1/support?offset="+offset,"GET",undefined,signal);if(!signal?.aborted){setHome(value);setDraft(old=>({...old,schoolId:old.schoolId||value.context.schools[0]?.id||""}));}return value;},[offset]);
 useEffect(()=>{const controller=new AbortController();setLoading(true);setError("");void load(controller.signal).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return ()=>controller.abort();},[load]);
 const loadDetail=useCallback(async(signal?:AbortSignal)=>{if(!selected)return;const value=await supportApi<TicketData>("/api/v1/support/"+selected,"GET",undefined,signal);if(!signal?.aborted)setDetail(value);},[selected]);
 useEffect(()=>{const controller=new AbortController();setDetail(null);if(selected)void loadDetail(controller.signal).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return ()=>controller.abort();},[selected,loadDetail]);
 async function submit(){if(busy)return;setBusy(true);setError("");setNotice("");const key=requestId||crypto.randomUUID();setRequestId(key);
 try{const result=await supportApi<{id:string;reference:string}>("/api/v1/support","POST",{requestId:key,...draft});setNotice("Your submission has been logged as "+result.reference+" for technical review. Follow its progress under My requests.");setRequestId("");setDraft({...draft,title:"",description:""});setSelected(result.id);try{await load();}catch{setNotice("Submission logged as "+result.reference+". Refresh My requests to update the list.");}}
 catch(e){setError(e instanceof Error?e.message:"Check My requests before retrying.");}finally{setBusy(false);}
 }
 return <main className={s.shell}><header className={s.head}><a href="/dashboard">SpaceCase<small>Help & feedback</small></a><form action="/auth/logout" method="post"><button className={s.secondary}>Sign out</button></form></header><div className={s.content}>
 <h1>Help us improve your workspace</h1><p>Report a fault, describe a difficult experience or suggest an improvement. Your requests are available to you, the founder and authorised support agents assigned to handle them. Read-only observers see queue metadata, not your report text.</p>
 {home?.context.founder?<p><a className={s.button} href="/founder">Open founder control centre</a></p>:null}
 {home?.context.observerSchools?.length?<p><a className={s.button} href="/operations">Open operations desk</a></p>:null}
 {error?<p role="alert" className={s.error}>{error}</p>:null}{notice?<p role="status" className={s.notice}>{notice}</p>:null}
 {loading?<p role="status">Checking your school access…</p>:null}
 {home&&home.context.schools.length===0?<section className={s.card}><h2>School access required</h2><p>Your account needs a current teacher or administrator assignment to submit school support requests.</p></section>:home?<section className={s.card}><h2>Report an issue or share feedback</h2><p className={s.muted}>Only include information needed to explain the issue. Do not include learner names, assessment results, passwords or private family information. Screenshot uploads are not enabled in this first release.</p>
 <form onSubmit={e=>{e.preventDefault();void submit();}}><div className={s.grid}>
 <label className={s.field}>School<select required value={draft.schoolId} disabled={busy} onChange={e=>setDraft({...draft,schoolId:e.target.value})}>{home.context.schools.map(school=><option key={school.id} value={school.id}>{school.displayName}</option>)}</select></label>
 <label className={s.field}>Submission type<select value={draft.category} disabled={busy} onChange={e=>setDraft({...draft,category:e.target.value})}><option value="BUG">Something is not working</option><option value="EXPERIENCE">A difficult user experience</option><option value="SUGGESTION">An improvement suggestion</option></select></label>
 <label className={s.field}>Affected area<select value={draft.area} disabled={busy} onChange={e=>setDraft({...draft,area:e.target.value})}>{areas.map(area=><option key={area} value={area}>{area.replaceAll("_"," ")}</option>)}</select></label>
 <label className={s.field}>Impact<select value={draft.impact} disabled={busy} onChange={e=>setDraft({...draft,impact:e.target.value})}><option value="BLOCKED">I cannot complete my work</option><option value="DEGRADED">I can continue, with difficulty</option><option value="IDEA">An idea for improvement</option></select></label></div>
 <label className={s.field}>Short title<input required minLength={3} maxLength={120} value={draft.title} disabled={busy} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
 <label className={s.field}>What happened, and what did you expect?<textarea required minLength={10} maxLength={4000} value={draft.description} disabled={busy} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
 <button className={s.button} disabled={busy||loading}>{busy?"Logging your submission…":"Log submission"}</button><p className={s.muted}>Acknowledgement and updates appear here. No email or automated investigation is started by submitting a ticket.</p></form></section>:null}
 <section className={s.card}><div className={s.actions}><h2>My requests</h2><button className={s.secondary} disabled={busy||loading} onClick={()=>{setError("");void load().catch(e=>setError(e.message));}}>Refresh requests</button></div>
 {home?.tickets.length?home.tickets.map(ticket=><article className={s.row} key={ticket.id}><div><strong>{ticket.reference} · {ticket.title}</strong><p className={s.muted}>{statusLabels[ticket.status]} · {showDate(ticket.updatedAt)}</p></div><button className={s.secondary} onClick={()=>{setError("");setSelected(ticket.id);}}>View request</button></article>):<p>No requests are shown on this page.</p>}
 <div className={s.actions}><button className={s.secondary} disabled={offset===0||loading||busy} onClick={()=>setOffset(Math.max(0,offset-50))}>Previous</button><span>Page {offset/50+1}</span><button className={s.secondary} disabled={!home?.nextOffset||loading||busy} onClick={()=>setOffset(home!.nextOffset!)}>Next</button></div></section>
 {selected&&!detail?<p role="status">Loading request…</p>:null}{detail?<TicketPanel key={detail.ticket.id} data={detail} reload={async()=>{await loadDetail();await load();}}/>:null}
 </div></main>;
}
