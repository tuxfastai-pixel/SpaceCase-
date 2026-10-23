'use client';
import EngineeringLinkedReview from './EngineeringLinkedReview';
import EngineeringTaskHistory from './EngineeringTaskHistory';
import {useCallback,useEffect,useState} from 'react';
import {taskListSchema,type EngineeringTaskList} from '../../../packages/engineering-control/control-contract';
import {savedTaskSchema} from '../../../packages/engineering-control/result';
import {supportApi} from '../../support/shared';import s from '../../support/support.module.css';
export default function EngineeringTasksPanel({ticketId,sourceRevision,refreshKey}:{ticketId:string;sourceRevision:number;refreshKey:number}){
 const [data,setData]=useState<EngineeringTaskList|null>(null),[offset,setOffset]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[pendingCancel,setPendingCancel]=useState<string|null>(null);
 const load=useCallback(async(nextOffset:number,signal?:AbortSignal)=>{
  setBusy(true);setError('');
  try{const result=taskListSchema.parse(await supportApi('/api/v1/founder','POST',{action:'LIST_ENGINEERING_TASKS',ticketId,offset:nextOffset},signal));if(!signal?.aborted){setData(result);setOffset(nextOffset);}}
  catch(e){if(!signal?.aborted)setError(e instanceof Error?e.message:'Saved tasks could not be loaded.');}
  finally{if(!signal?.aborted)setBusy(false);}
 },[ticketId]);
 useEffect(()=>{const controller=new AbortController();void load(0,controller.signal);return()=>controller.abort();},[load,refreshKey]);
 async function cancel(task:EngineeringTaskList['tasks'][number]){
  setBusy(true);setError('');setNotice('');setPendingCancel(null);
  try{const result=savedTaskSchema.parse(await supportApi('/api/v1/founder','POST',{action:'CANCEL_ENGINEERING_TASK',ticketId,taskId:task.id,revision:task.revision}));
   if(result.task.id!==task.id||result.task.sourceReference!==task.sourceReference||result.task.state!=='CANCELLED'||result.task.revision!==task.revision+1)throw Error('Cancellation could not be confirmed.');
   setNotice('Task cancelled. Its audit history is retained and no agent was started.');await load(offset);
  }catch(e){setError(`${e instanceof Error?e.message:'Cancellation could not be confirmed.'} Refresh the list to check its current state, or retry the same task.`);setBusy(false);}
 }
 return <section aria-label='Saved engineering tasks'><h4>Saved tasks for this ticket</h4><p>These are storage records, not running agents. Saved brief content is not loaded here.</p>
 <button type='button' className={s.secondary} disabled={busy} onClick={()=>void load(offset)}>{busy?'Loading…':'Refresh saved tasks'}</button>
 {error?<p role='alert' className={s.error}>{error}</p>:null}{notice?<p role='status' className={s.notice}>{notice}</p>:null}
 {data&&!data.tasks.length?<p>No engineering tasks have been saved for this ticket.</p>:null}
 {data?.tasks.map(task=><article className={s.card} key={task.id}><p style={{overflowWrap:'anywhere'}}><strong>{task.state==='CANCELLED'?'Cancelled':'Blocked — no execution'}</strong> · {task.id}</p>
 <p>Ticket revision {task.sourceRevision}{task.sourceRevision!==sourceRevision?' · older ticket revision':''} · task revision {task.revision}</p>
 <p style={{overflowWrap:'anywhere'}}>Base commit: {task.baseCommit}</p><p>{task.briefAvailable?`Brief expires ${new Date(task.briefExpiresAt).toLocaleString()}.`:'Brief expired or removed. The task reference and audit history remain.'}</p>
 <EngineeringLinkedReview ticketId={ticketId} taskId={task.id} sourceReference={task.sourceReference} revision={task.revision} onChanged={()=>void load(offset)}/>
 <EngineeringTaskHistory ticketId={ticketId} taskId={task.id} sourceReference={task.sourceReference} revision={task.revision}/>
 {task.state==='BLOCKED'?(pendingCancel===task.id?<div role='group' aria-label='Confirm task cancellation'><p>Cancel this task permanently? It cannot be restored, and saving the same brief and base commit will return this cancelled task.</p><div className={s.actions}><button type='button' className={s.secondary} disabled={busy} onClick={()=>void cancel(task)}>Confirm cancellation</button><button type='button' className={s.secondary} disabled={busy} onClick={()=>setPendingCancel(null)}>Keep task</button></div></div>:<button type='button' className={s.secondary} disabled={busy} onClick={()=>setPendingCancel(task.id)}>Cancel task</button>):null}</article>)}
 {data?<div className={s.actions}><button type='button' className={s.secondary} disabled={busy||offset===0} onClick={()=>void load(Math.max(0,offset-25))}>Newer tasks</button><button type='button' className={s.secondary} disabled={busy||data.nextOffset===null} onClick={()=>{if(data.nextOffset!==null)void load(data.nextOffset);}}>Older tasks</button></div>:null}
 </section>;
}
