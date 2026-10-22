'use client';
import {useState} from 'react';
import {handoffSchema,engineeringBriefSchema,projectRegistry,type EngineeringHandoff} from '../../../packages/engineering-control/contracts';
import {supportApi,type Ticket} from '../../support/shared';
import s from '../../support/support.module.css';
type Packet={handoff:EngineeringHandoff;digest:string;executionStarted:false};
export default function EngineeringHandoffPanel({ticket}:{ticket:Ticket}){
 const [draft,setDraft]=useState({problem:'',expected:'',observed:'',steps:'',acceptance:''}),[reviewed,setReviewed]=useState(false);
 const [packet,setPacket]=useState<Packet|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const closed=['RESOLVED','CLOSED'].includes(ticket.status);
 const lines=(v:string)=>v.split('\n').map(x=>x.trim()).filter(Boolean);
 function change(key:keyof typeof draft,value:string){setDraft(d=>({...d,[key]:value}));setPacket(null);setReviewed(false);setNotice('');}
 async function prepare(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setError('');setNotice('');setPacket(null);
  const brief=engineeringBriefSchema.safeParse({...draft,steps:lines(draft.steps),acceptance:lines(draft.acceptance)});
  if(!brief.success||!reviewed){setError('Complete the reviewed problem, expected and observed behaviour, 1–8 reproduction steps and 1–8 acceptance checks.');return;}
  setBusy(true);try{const result=await supportApi<Packet>('/api/v1/founder','POST',{action:'ENGINEERING_HANDOFF',ticketId:ticket.id,revision:ticket.revision,brief:brief.data,privacyReviewed:true});const handoff=handoffSchema.parse(result.handoff);
   if(!/^[a-f0-9]{64}$/.test(result.digest)||result.executionStarted!==false||handoff.source.reference!==ticket.reference||handoff.source.revision!==ticket.revision)throw Error('The handoff could not be verified. Reload this ticket.');
   setPacket({...result,handoff});setNotice('Handoff prepared. Its digest and source revision were audited. No agent was started.');
  }catch(e){setError(e instanceof Error?e.message:'The handoff could not be confirmed.');}finally{setBusy(false);}
 }
 async function copy(){if(!packet)return;try{await navigator.clipboard.writeText(JSON.stringify(packet,null,2));setNotice('Reviewed handoff copied. It has not been sent to an agent or external service.');}catch{setError('Clipboard unavailable. Select the JSON below to copy it.');}}
 return <section className={s.card} aria-labelledby='engineering-handoff-heading'><h3 id='engineering-handoff-heading'>Engineering desk · Stage 1</h3>
 <p>Prepare a reviewed task for a future engineering team. SpaceCase supplies the ticket; the shared PSG contract defines responsibilities, evidence and founder review. This creates a handoff, not an investigation or a deployed fix.</p>
 <div className={s.stats}>{Object.entries(projectRegistry).map(([id,p])=><div key={id} className={s.stat}><strong>{p.name}</strong>{p.status==='HANDOFF_READY'?'Handoff preparation available':'Project adapter not connected'}</div>)}</div>
 <p className={s.notice}>Agent runner: not connected. Model calls, repository writes, external transfers and production changes are disabled. Existing staff assignments refer to people; they do not authorise AI agents.</p>
 {closed?<p>This ticket is resolved or closed. Reopen it through the existing ticket workflow before preparing new work.</p>:<details><summary>Prepare a reviewed engineering handoff</summary><p>Rewrite the issue using synthetic examples. The original title, description, school identity and reporter details are not copied into the handoff. This form does not automatically detect or remove personal information.</p>
 <form onSubmit={prepare}><fieldset disabled={busy} style={{border:0,padding:0,margin:0}}>
 {([['problem','Problem to investigate',10,1200],['expected','Expected behaviour',5,800],['observed','Observed behaviour',5,800],['steps','Reproduction steps — one per line, up to 8',3,4000],['acceptance','Acceptance checks — one per line, up to 8',5,4000]] as const).map(([key,label,min,max])=><label className={s.field} key={key}>{label}<textarea required minLength={min} maxLength={max} rows={3} value={draft[key]} onChange={e=>change(key,e.target.value)}/></label>)}
 <label><input type='checkbox' required checked={reviewed} onChange={e=>{setReviewed(e.target.checked);setPacket(null);}}/> I reviewed this brief and removed real learner/family details, school contacts, credentials and other private data; reproduction uses synthetic examples.</label>
 <p className={s.muted}>Preparing the handoff records an audit digest. The brief itself is not saved: copy it if you need it after leaving this page. Changing the draft or ticket revision invalidates this preview.</p>
 <button className={s.button} disabled={!reviewed||busy}>{busy?'Preparing…':'Prepare handoff'}</button></fieldset></form></details>}
 {error?<p className={s.error} role='alert'>{error}</p>:null}{notice?<p className={s.notice} role='status'>{notice}</p>:null}
 {packet?<section aria-label='Reviewed engineering handoff'><p><strong>{packet.handoff.repository}</strong> · {packet.handoff.source.reference} · source revision {packet.handoff.source.revision}</p>
 <h4>Responsibilities and review gates</h4><ol>{packet.handoff.roles.map(r=><li key={r.role}><strong>{r.role.replaceAll('_',' ')}</strong>: {r.task}</li>)}</ol>
 <h4>Required evidence</h4><ul>{packet.handoff.requirements.map(r=><li key={r}>{r}</li>)}</ul>
 <p className={s.muted}>No work has been assigned or executed. A copied packet cannot grant tool access, spend money or approve a release. A future runner must recheck the source revision and current authority.</p>
 <button className={s.secondary} onClick={()=>void copy()}>Copy reviewed handoff</button><details><summary>View versioned handoff JSON and digest</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(packet,null,2)}</pre></details></section>:null}
 </section>;
}
