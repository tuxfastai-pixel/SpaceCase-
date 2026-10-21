"use client";
import {useCallback,useEffect,useState} from "react";
import {supportApi,showDate} from "../support/shared";
import s from "../support/support.module.css";
type Data={tickets:Array<{id:string;reference:string;area:string;priority:string;escalatedAt:string}>;nextOffset:number|null};
export default function EscalationInbox({open}:{open:(id:string)=>void}){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(""),[offset,setOffset]=useState(0);
 const load=useCallback(async(signal?:AbortSignal)=>{const d=await supportApi<Data>("/api/v1/founder/casework?offset="+offset,"GET",undefined,signal);if(!signal?.aborted)setData(d);},[offset]);
 useEffect(()=>{const c=new AbortController();setData(null);void load(c.signal).catch(e=>{if(!c.signal.aborted)setError(e.message);});return ()=>c.abort();},[load]);
 return <section className={s.card}><h2>Staff escalations</h2><p>Cases explicitly escalated by their assigned support agent. Review the internal reason before deciding. No external notification is sent.</p>{error?<p className={s.error} role="alert">{error}</p>:null}<button className={s.secondary} onClick={()=>{setError("");void load().catch(e=>setError(e.message));}}>Refresh escalations</button>{data?.tickets.map(t=><article className={s.row} key={t.id}><p>{t.reference} · {t.area} · {t.priority} · {showDate(t.escalatedAt)}</p><button className={s.button} onClick={()=>open(t.id)}>Review escalation</button></article>)}{data&&!data.tickets.length?<p>No pending staff escalations.</p>:null}<div className={s.actions}><button className={s.secondary} disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-50))}>Previous</button><button className={s.secondary} disabled={data?.nextOffset==null} onClick={()=>setOffset(data!.nextOffset!)}>Next</button></div></section>;
}
