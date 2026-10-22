'use client';
import {useState} from 'react';
import type {EngineeringHandoff} from '../../../packages/engineering-control/contracts';
import type {SavedEngineeringTask} from '../../../packages/engineering-control/result';
import {supportApi} from '../../support/shared';
import {newSaveAttempt,confirmSavedTask} from './saveAttempt';
import s from '../../support/support.module.css';
export default function EngineeringSavePanel({ticketId,packet,onLock,onSaved}:{ticketId:string;packet:{handoff:EngineeringHandoff;digest:string;storage?:{available:boolean;retentionDays:7;baseCommit?:string}};onLock:(locked:boolean)=>void;onSaved?:()=>void}){
 const [commit,setCommit]=useState(packet.storage?.baseCommit??''),[consent,setConsent]=useState(false),[attempt,setAttempt]=useState<ReturnType<typeof newSaveAttempt>|null>(null),[busy,setBusy]=useState(false),[saved,setSaved]=useState<SavedEngineeringTask|null>(null),[error,setError]=useState('');
 async function save(){
  if(!consent||busy||saved)return;setError('');
  let next;try{next=attempt??newSaveAttempt(ticketId,packet,commit.trim(),crypto.randomUUID());}catch(e){setError(e instanceof Error?e.message:'Check the commit reference.');return;}
  setAttempt(next);setBusy(true);onLock(true);
  try{const result=confirmSavedTask(await supportApi('/api/v1/founder','POST',next),packet,next.baseCommit);setSaved(result);onLock(false);onSaved?.();}
  catch(e){setError(`${e instanceof Error?e.message:'Save could not be confirmed.'} The task may already exist. Retry this same request; its reference and content are preserved while this page stays open.`);}
  finally{setBusy(false);}
 }
 return <section aria-label='Save reviewed engineering task'><h4>Save reviewed task</h4>
 {!packet.storage?.available?<p className={s.notice}>Task storage is not configured. This preview is not saved; you can copy the handoff. No agent will run.</p>:<>
 <p>Save only this reviewed brief in the separate PSG engineering ledger. Its content expires after seven days; daily cleanup removes it. Minimal task references and audit events remain. Saving does not start an agent or approve a release.</p>
 <fieldset disabled={Boolean(attempt)||busy||Boolean(saved)} style={{border:0,padding:0,margin:0}}><label className={s.field}>Reviewed base commit SHA<input value={commit} onChange={e=>setCommit(e.target.value)} minLength={40} maxLength={40} spellCheck={false} autoComplete='off'/></label>
 <label><input type='checkbox' checked={consent} onChange={e=>setConsent(e.target.checked)}/> I agree to store this synthetic, privacy-reviewed brief in the PSG engineering ledger for seven days.</label></fieldset>
 {!saved?<button type='button' className={s.button} disabled={!consent||busy||!/^[a-f0-9]{40}$/.test(commit.trim())} onClick={()=>void save()}>{busy?'Confirming save…':attempt?'Retry same save':'Save blocked task'}</button>:<p className={s.notice} role='status'>Task {saved.task.id} · {saved.task.state.toLowerCase()}. {saved.task.briefAvailable?`Brief expires ${new Date(saved.task.briefExpiresAt).toLocaleString()}.`:'The saved brief has expired or was removed.'} No agent was started.</p>}
 {attempt?<p className={s.muted}>Save reference: <span style={{overflowWrap:'anywhere'}}>{attempt.requestId}</span>. After an uncertain result, retry here before changing the draft. Leaving the page clears the local preview and retry details.</p>:null}
 {error?<p className={s.error} role='alert'>{error}</p>:null}</>}
 </section>;
}
