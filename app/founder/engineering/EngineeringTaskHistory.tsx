'use client';
import {useEffect,useState} from 'react';
import {taskHistorySchema,type EngineeringTaskHistory} from '../../../packages/engineering-control/control-contract';
import {supportApi} from '../../support/shared';
import s from '../../support/support.module.css';
const labels={CREATED:'Reviewed task saved',CANCELLED:'Task cancelled',BRIEF_EXPIRED:'Saved brief removed by retention'};
export default function EngineeringTaskHistory({ticketId,taskId,sourceReference,revision}:{ticketId:string;taskId:string;sourceReference:string;revision:number}){
 const [open,setOpen]=useState(false),[reload,setReload]=useState(0),[data,setData]=useState<EngineeringTaskHistory|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  if(!open)return;const controller=new AbortController();setBusy(true);setData(null);setError('');
  async function load(){try{
   const result=taskHistorySchema.parse(await supportApi('/api/v1/founder','POST',{action:'ENGINEERING_TASK_HISTORY',ticketId,taskId},controller.signal));
   if(result.taskId!==taskId||result.sourceReference!==sourceReference)throw Error('History could not be confirmed for this task.');
   if(!controller.signal.aborted)setData(result);
  }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Task history could not be loaded.');}
  finally{if(!controller.signal.aborted)setBusy(false);}}
  void load();return()=>controller.abort();
 },[open,reload,ticketId,taskId,sourceReference,revision]);
 return <div><button type='button' className={s.secondary} aria-expanded={open} onClick={()=>setOpen(value=>!value)}>{open?'Hide task history':'View task history'}</button>
 {open?<section aria-label='Task audit history'><p>Latest recorded events, newest first. This view contains no saved brief content or personal identifiers.</p>
 <button type='button' className={s.secondary} disabled={busy} onClick={()=>setReload(value=>value+1)}>{busy?'Loading history…':'Refresh task history'}</button>
 {error?<p role='alert' className={s.error}>{error}</p>:null}
 {data?<><p className={s.muted}>Snapshot loaded. Refresh to check for later events.</p>{data.events.length?<ol>{data.events.map(event=><li key={event.id} className={s.event}><strong>{labels[event.kind]}</strong><p>Task revision {event.revision} · <time dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleString()}</time></p></li>)}</ol>:<p>No audit events are available for this task.</p>}{data.truncated?<p>Showing the latest 25 events. Earlier events remain in the audit store.</p>:null}</>:null}
 </section>:null}</div>;
}
