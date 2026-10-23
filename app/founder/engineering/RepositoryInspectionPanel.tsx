'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {repositoryInspectionInput,repositoryInspectionSchema,type RepositoryInspection} from '../../../packages/engineering-control/repository-contract';
import {supportApi} from '../../support/shared';import s from '../../support/support.module.css';
const labels={PASSED:'Validate workflow succeeded',PENDING:'Validation is pending',FAILED:'Validation did not succeed',MISSING:'No matching validation was found',INCOMPLETE:'Validation data is incomplete'};
const blockers={HEAD_CHANGED:'The current head differs from the commit you entered.',PR_NOT_OPEN:'The pull request is closed or merged.',DRAFT_PR:'The pull request is a draft.',BASE_BRANCH_NOT_MAIN:'The target branch is not main.',VALIDATION_PENDING:'Wait for current validation to finish.',VALIDATION_FAILED:'A current validation run did not succeed.',VALIDATION_MISSING:'No eligible Validate run was found for this head.',VALIDATION_INCOMPLETE:'The bounded response cannot confirm all current runs.'};
function InspectionForm(){
 const [number,setNumber]=useState(''),[head,setHead]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<RepositoryInspection|null>(null);
 const controller=useRef<AbortController|null>(null);useEffect(()=>()=>controller.current?.abort(),[]);
 function change(field:'number'|'head',value:string){if(field==='number')setNumber(value);else setHead(value);setResult(null);setError('');}
 async function inspect(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setResult(null);setError('');const input=repositoryInspectionInput.safeParse({pullRequest:Number(number),expectedHeadCommit:head.trim()});
  if(!input.success){setError('Enter a pull request number and its full 40-character lowercase head commit.');return;}
  const request=new AbortController();controller.current=request;setBusy(true);
  try{const value=repositoryInspectionSchema.parse(await supportApi('/api/v1/founder','POST',{action:'INSPECT_ENGINEERING_PR',...input.data},request.signal));
   if(value.pullRequest!==input.data.pullRequest||value.expectedHeadCommit!==input.data.expectedHeadCommit)throw Error('The inspection does not match this request.');if(!request.signal.aborted)setResult(value);
  }catch(e){if(!request.signal.aborted)setError(e instanceof Error?e.message:'Validation could not be confirmed.');}finally{if(!request.signal.aborted)setBusy(false);}
 }
 const github='https://github.com/tuxfastai-pixel/SpaceCase-';
 return <><p>Read the public SpaceCase repository’s Validate workflow for an exact pull-request head. This check is separate from the ticket and saved tasks. It does not verify individual tests, code-review findings, reproduction, rollback, or task association.</p>
 <form onSubmit={inspect}><fieldset disabled={busy} style={{border:0,padding:0,margin:0}}><label className={s.field}>Pull request number<input inputMode='numeric' type='number' min='1' max='100000000' required value={number} onChange={e=>change('number',e.target.value)}/></label>
 <label className={s.field}>Expected head commit<input required pattern='[a-f0-9]{40}' maxLength={40} spellCheck={false} autoCapitalize='none' autoComplete='off' value={head} onChange={e=>change('head',e.target.value)}/></label>
 <p className={s.muted}>Use the latest full commit SHA from GitHub’s pull-request Commits tab. Checks run only when requested and may be limited by GitHub.</p><button className={s.button}>{busy?'Checking GitHub…':'Check repository workflow'}</button></fieldset></form>
 {error?<p role='alert' className={s.error}>{error}</p>:null}
 {result?<section aria-label='Repository workflow snapshot'><h5>{labels[result.validation]}</h5><p><a href={`${github}/pull/${result.pullRequest}`} target='_blank' rel='noreferrer'>Pull request #{result.pullRequest}</a> · {result.state.toLowerCase()}{result.draft?' · draft':''}</p>
 <p style={{overflowWrap:'anywhere'}}>Current head: {result.headCommit}</p><p>Target branch: {result.baseBranch}</p><p>Snapshot: <time dateTime={result.observedAt}>{new Date(result.observedAt).toLocaleString()}</time>. Check again if the pull request changes.</p>
 {result.blockers.length?<ul>{result.blockers.map(code=><li key={code}>{blockers[code]}</li>)}</ul>:<p>No workflow blockers were found in this snapshot.</p>}
 <ul>{result.runs.map(run=><li key={run.id}><a href={`${github}/actions/runs/${run.id}`} target='_blank' rel='noreferrer'>{run.event==='push'?'Branch push':'Pull request'} run {run.id}</a> · attempt {run.attempt} · {run.status} · {run.conclusion??'no conclusion yet'}</li>)}</ul>
 <p className={s.warning}>This snapshot grants no task approval or release permission. An independent code review and the remaining engineering review gates are still required.</p></section>:null}</>;
}
export default function RepositoryInspectionPanel(){const [open,setOpen]=useState(false),id=useId();return <section><h4>Repository workflow inspection</h4><button type='button' className={s.secondary} aria-expanded={open} aria-controls={id} onClick={()=>setOpen(value=>!value)}>{open?'Hide repository inspection':'Inspect a pull request'}</button><div id={id}>{open?<InspectionForm/>:null}</div></section>;}
