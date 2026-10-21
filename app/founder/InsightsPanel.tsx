"use client";
import {useEffect,useState} from "react";
import {supportApi,showDate} from "../support/shared";
import s from "../support/support.module.css";
type Insights={asOf:string;windowDays:number;workspaces:{recordedWorkspaces:number;activeWorkspaces:number;incompleteWorkspaces:number};activity:{schoolsUpdatingRegisters:number;registersUpdated:number};submissions:{current:number;previous:number};queue:{open:number;blocked:number;urgent:number;olderThan48Hours:number};response:{submitted:number;responded:number;medianFirstResponseHours:number|null};patterns:Array<{area:string;category:string;tickets:number;schools:number}>;patternMinimumSchools:number;unmeasured:string[]};
export default function InsightsPanel(){
 const [data,setData]=useState<Insights|null>(null);const [error,setError]=useState("");
 useEffect(()=>{const controller=new AbortController();void supportApi<Insights>("/api/v1/founder?view=insights","GET",undefined,controller.signal).then(d=>{if(!controller.signal.aborted)setData(d);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return ()=>controller.abort();},[]);
 if(error)return <p className={s.error} role="alert">{error}</p>;
 if(!data)return <p role="status">Loading founder measurements…</p>;
 const metrics=[[data.workspaces.activeWorkspaces,"Active configured workspaces"],[data.activity.schoolsUpdatingRegisters,"Schools updating registers · 30 days"],[data.activity.registersUpdated,"Registers last updated · 30 days"],[data.queue.open,"Open support requests"],[data.queue.blocked,"Open requests reporting blocked work"],[data.queue.olderThan48Hours,"Open requests submitted over 48 hours ago"]];
 return <><section className={s.card}><h2>Founder briefing</h2><p className={s.muted}>Snapshot {showDate(data.asOf)}. Measurements cover product records, not every school in the canonical directory.</p><div className={s.stats}>{metrics.map(([n,label])=><div className={s.stat} key={String(label)}><strong>{n}</strong>{label}</div>)}</div>
 <p>{data.submissions.current} requests submitted in the last 30 days, compared with {data.submissions.previous} in the preceding 30 days. This measures reporting volume, not incident frequency or user satisfaction.</p>
 <p>{data.response.responded} of {data.response.submitted} recent submissions have a recorded technical update. Median time to the first update: {data.response.medianFirstResponseHours===null?"Not yet measured":data.response.medianFirstResponseHours+" hours"}. Unanswered requests are excluded from the median.</p>
 <p>{data.workspaces.incompleteWorkspaces} active workspaces lack a timezone or academic year. {data.queue.urgent} open requests are marked urgent.</p>
 <p className={s.muted}>Register activity means each register’s latest saved update falls inside the window. It does not measure expected register completion, teacher performance, unique daily users or every save.</p></section>
 <section className={s.card}><h2>Patterns and opportunities</h2><p>Groups appear only when at least {data.patternMinimumSchools} distinct schools submitted requests in the same area and category during the last 30 days. Ticket narratives and individual users are excluded.</p>
 {data.patterns.length?data.patterns.map(p=><article className={s.notice} key={p.area+p.category}><strong>{p.area} · {p.category}</strong><p>{p.tickets} submissions across {p.schools} schools.</p><p>Next step: review representative requests, form a hypothesis and test an improvement. A shared category does not establish a common cause.</p></article>):<p>No cross-school pattern meets the minimum evidence threshold yet.</p>}
 <p className={s.muted}>These are rule-based evidence groups. AI investigation, experiment execution and introductions to external networks are not connected.</p></section>
 <section className={s.card}><h2>Measurement gaps</h2><ul>{data.unmeasured.map(item=><li key={item}>{item} — not yet measured.</li>)}</ul><p>No automatic repairs, school suspensions or user rankings are triggered by these measurements.</p></section></>;
}
