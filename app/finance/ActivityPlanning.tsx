'use client';
import ReportDateInput from '../reports/ReportDateInput';
import {useState,useEffect,useRef,type FormEvent} from 'react';
import {activityBalances,type ContributionMode} from '../../domains/school-activities/contributions';
import {formatZar} from './forms';
import {financeDateLabel} from './presentation';
import type {ActivityDetails} from '../../domains/school-activities/registerContracts';
import {FinanceIcon} from './FinanceUi';
import {buildActivityPreview,planningActivities,type DraftActivity} from './activityPlanningModel';
import s from './finance.module.css';
import p from './activityPlanning.module.css';
type Preview=ReturnType<typeof buildActivityPreview>;
export default function ActivityPlanning({initialActivities=[]}:{initialActivities?:ActivityDetails[]}){
 const [events,setEvents]=useState<DraftActivity[]>(()=>initialActivities.length?initialActivities.map((row,i)=>{const n=BigInt(row.amountMinor);return {id:`activity-${i+1}`,title:row.title,deadline:row.paymentDeadline,amount:`${n/100n}.${(n%100n).toString().padStart(2,'0')}`,chosen:''};}):[{id:'activity-1',title:'',deadline:'',amount:'',chosen:''}]);
 const [nextId,setNextId]=useState(initialActivities.length+2),[contribution,setContribution]=useState(''),[mode,setMode]=useState<ContributionMode>('EARLIEST');
 const [scheduled,setScheduled]=useState(false),[dates,setDates]=useState([{id:'payment-1',date:'',amount:''}]),[variable,setVariable]=useState(false),[step,setStep]=useState<1|2|3>(1),[total,setTotal]=useState('0');
 const previewRef=useRef<HTMLElement>(null),heading=useRef<HTMLHeadingElement>(null),previousStep=useRef(1),adjustments=useRef<HTMLDetailsElement>(null);
 const [preview,setPreview]=useState<Preview|null>(null),[error,setError]=useState('');
 useEffect(()=>{if(previousStep.current===step)return;previousStep.current=step;if(step!==3){heading.current?.scrollIntoView({block:'nearest',behavior:'auto'});heading.current?.focus({preventScroll:true});}},[step]);
 useEffect(()=>{if(!preview)return;const target=previewRef.current;target?.scrollIntoView({block:'start',behavior:'auto'});target?.focus({preventScroll:true});target?.classList.add(s.recordHighlight);const timer=setTimeout(()=>target?.classList.remove(s.recordHighlight),4500);return()=>{clearTimeout(timer);target?.classList.remove(s.recordHighlight);};},[preview]);
 useEffect(()=>{if(initialActivities.length){const target=document.getElementById('activity-planning-title');target?.scrollIntoView({block:'start'});target?.focus({preventScroll:true});}},[initialActivities.length]);
 function clear(){setPreview(null);setError('');}
 function changeEvent(id:string,key:keyof Omit<DraftActivity,'id'>,value:string){clear();setEvents(rows=>rows.map(row=>row.id===id?{...row,[key]:value}:row));}
 function displayError(reason:unknown){setError(reason instanceof Error&&!['ZodError','SchoolFinanceError'].includes(reason.name)&&!/^([A-Z_]+)$/.test(reason.message)?reason.message:'Check the activity names, amounts and dates. Payment dates must be unique and in order.');}
 function chooseActivities(event:FormEvent){event.preventDefault();clear();try{const value=activityBalances(planningActivities(events));if(BigInt(value.totalMinor)<=0n)throw Error('Add an activity amount greater than zero.');setTotal(value.totalMinor);setStep(2);}catch(reason){displayError(reason);}}
 function preset(half:boolean){clear();const amount=BigInt(total),value=half?(amount+1n)/2n:amount;setContribution(`${value/100n}.${(value%100n).toString().padStart(2,'0')}`);}
 function calculate(event:FormEvent){event.preventDefault();clear();try{setPreview(buildActivityPreview(events,contribution,{mode,scheduled,dates,variable}));setStep(3);}catch(reason){if(adjusted&&adjustments.current)adjustments.current.open=true;displayError(reason);}}
 function resetOptions(){clear();setMode('EARLIEST');setScheduled(false);setVariable(false);setDates([{id:'payment-1',date:'',amount:''}]);setEvents(rows=>rows.map(row=>({...row,chosen:''})));}
 const adjusted=mode!=='EARLIEST'||scheduled||events.some(row=>row.chosen.trim());
 return <section className={s.card} aria-labelledby='activity-planning-title'>
  <h2 id='activity-planning-title' tabIndex={-1}><FinanceIcon name='budget'/> Preview the parent’s experience</h2>
  <p>Try how a family could cover activity costs, one step at a time.</p>
  <p className={s.note}>Staff preview only. Nothing is saved to a parent account, charged or marked as paid.</p>
  <ol className={p.steps} aria-label='Preview progress'>{['Choose activities','Try an amount','See the result'].map((label,i)=><li key={label} aria-current={step===i+1?'step':undefined}><span>{i+1}</span>{label}</li>)}</ol>
  {step!==3&&<h3 ref={heading} tabIndex={-1}>{step===1?'Choose activities':'Try an amount'}</h3>}
  {step===1&&<form onSubmit={chooseActivities} data-guided-flow data-guide-step='activities'><fieldset className={s.planningFields}><legend className={p.legend}>Activities for one learner</legend>
   <p>Use the published activities selected above, or enter estimates to explore. This does not create an activity or learner invoice.</p>
   {events.map((row,index)=><div className={s.planningEvent} key={row.id}><h4>Activity {index+1}</h4><div className={s.planningGrid}>
    <label>Activity name<input required maxLength={160} value={row.title} onChange={e=>changeEvent(row.id,'title',e.target.value)}/></label>
    <label>Cost per learner (R)<input required inputMode='decimal' value={row.amount} onChange={e=>changeEvent(row.id,'amount',e.target.value)}/></label>
    <ReportDateInput label={`Activity ${index+1} money needed by`} value={row.deadline} onChange={value=>changeEvent(row.id,'deadline',value)}/>
   </div>{events.length>1&&<button type='button' className={s.secondary} onClick={()=>{clear();setEvents(rows=>rows.filter(r=>r.id!==row.id));}}>Remove activity {index+1}</button>}</div>)}
   <button type='button' className={s.secondary} disabled={events.length>=20} onClick={()=>{clear();setEvents(rows=>[...rows,{id:`activity-${nextId}`,title:'',deadline:'',amount:'',chosen:''}]);setNextId(n=>n+1);}}>Add another activity</button>
  </fieldset>{error&&<p role='alert' className={s.error}>{error}</p>}<p className={s.note}>Next: try an amount against these activities.</p><button data-guide-next>Continue to amount <span aria-hidden='true'>→</span></button></form>}
  {step===2&&<form onSubmit={calculate} data-guided-flow data-guide-step='amount'>
   <p>Activities total: <strong>{formatZar(total)}</strong></p><div className={s.actions}><button type='button' className={s.secondary} onClick={()=>preset(true)}>About half</button><button type='button' className={s.secondary} onClick={()=>preset(false)}>Full amount</button></div>
   <label className={s.form}>What could the parent contribute now? (R)<input required inputMode='decimal' value={contribution} onChange={e=>{clear();setContribution(e.target.value);}}/></label>
   <p>{mode==='EARLIEST'?'SpaceCase covers the closest payment deadlines first.':mode==='SPREAD'?'This preview shares the amount across activity costs.':'This preview uses the amounts you choose for each activity.'}</p>
   {adjusted&&<p className={s.note}>Your adjusted options are included. Open “Adjust my options” to review or reset them.</p>}
   <details className={s.details} ref={adjustments}><summary>Adjust my options</summary>
    <label className={s.form}>Share the amount<select value={mode} onChange={e=>{clear();setMode(e.target.value as ContributionMode);}}><option value='EARLIEST'>Closest deadlines first</option><option value='SPREAD'>Spread across activity costs</option><option value='CUSTOM'>Choose all amounts myself</option></select></label>
    <details className={s.details} open={mode==='CUSTOM'?true:undefined}><summary>Set some aside for an activity</summary><p>Enter an amount for any activity you want to prioritise. Leave the others blank for automatic sharing. “Choose all amounts myself” leaves the rest unassigned.</p><div className={s.planningGrid}>{events.map((row,index)=><label key={row.id}>{row.title||`Activity ${index+1}`} (R)<input inputMode='decimal' value={row.chosen} onChange={e=>changeEvent(row.id,'chosen',e.target.value)}/></label>)}</div></details>
    <label><span><input type='checkbox' checked={scheduled} onChange={e=>{clear();setScheduled(e.target.checked);}}/> Add dates for the remaining balance</span></label>
    {scheduled&&<><p>Use the school’s approved dates. SpaceCase splits the remaining balance evenly unless you choose different amounts.</p><label><span><input type='checkbox' checked={variable} onChange={e=>{clear();setVariable(e.target.checked);}}/> Choose different payment amounts</span></label>
     {dates.map((row,index)=><div className={s.planningGrid} key={row.id}><ReportDateInput required={false} label={`Payment date ${index+1}`} value={row.date} onChange={value=>{clear();setDates(rows=>rows.map((r,i)=>i===index?{...r,date:value}:r));}}/>{variable&&<label>Amount {index+1} (R)<input inputMode='decimal' value={row.amount} onChange={e=>{clear();setDates(rows=>rows.map((r,i)=>i===index?{...r,amount:e.target.value}:r));}}/></label>}{dates.length>1&&<button type='button' className={s.secondary} onClick={()=>{clear();setDates(rows=>rows.filter((_,i)=>i!==index));}}>Remove payment date {index+1}</button>}</div>)}
     <button type='button' className={s.secondary} disabled={dates.length>=60} onClick={()=>{clear();setDates(rows=>[...rows,{id:crypto.randomUUID(),date:'',amount:''}]);}}>Add a payment date</button></>}
    <p><button type='button' className={s.secondary} onClick={resetOptions}>Reset to closest deadlines</button></p>
   </details>
   {error&&<p role='alert' className={s.error}>{error}</p>}<p className={s.note}>Next: see what this amount would cover. Nothing is paid or saved.</p><div className={s.actions}><button type='button' className={s.secondary} onClick={()=>{clear();setStep(1);}}>Back to activities</button><button data-guide-next><FinanceIcon name='search'/>Show the result</button></div>
  </form>}
  {step===3&&preview&&<section ref={previewRef} className={s.wizard} aria-label='Activity contribution preview' tabIndex={-1}>
   <h3>See the result</h3><p role='status'>Your preview is ready. This is not a payment confirmation.</p>
   <div className={s.summaryTiles}><div><span>Activities total</span><strong>{formatZar(preview.total)}</strong></div><div><span>Amount tried</span><strong>{formatZar(preview.distribution.contributionMinor)}</strong></div><div><span>Still to cover</span><strong>{formatZar(preview.distribution.remainingMinor)}</strong></div></div>
   <ul className={p.results}>{preview.distribution.rows.map(row=><li key={row.id}><strong>{row.title}</strong><span>Needed by {financeDateLabel(row.deadline)}</span><dl><div><dt>This amount would cover</dt><dd>{formatZar(row.proposedMinor)}</dd></div><div><dt>Still needed</dt><dd>{formatZar(row.remainingMinor)}</dd></div></dl></li>)}</ul>
   {preview.distribution.unassignedMinor!=='0'&&<p className={s.note}>{formatZar(preview.distribution.unassignedMinor)} is not assigned in this preview. Adjust the split or try a smaller amount. No account credit has been created.</p>}
   {!!preview.shortfalls.length&&<div className={s.softPanel}><strong>Some dates need attention</strong><ul>{preview.shortfalls.map(row=><li key={row.deadline}>By {financeDateLabel(row.deadline)}, another {formatZar(row.shortfallMinor)} would be needed beyond the payments planned by then.</li>)}</ul></div>}
   {!!preview.schedule.length&&<><h4>Suggested remaining payments</h4><ul>{preview.schedule.map(row=><li key={row.dueDate}>{financeDateLabel(row.dueDate)} — {formatZar(row.amountMinor)}</li>)}</ul></>}
   {preview.distribution.remainingMinor!=='0'&&!preview.scheduled&&<p className={s.note}>The remaining amount has no payment dates yet. Each activity’s deadline still applies. You can explore dates under “Adjust my options.”</p>}
   <p>This illustration does not save a parent agreement or verify money. Finance must verify and allocate actual receipts before account balances change.</p>
   <div className={s.actions}><button type='button' data-guide-next onClick={()=>{setError('');setStep(2);}}>Try another amount</button><button type='button' className={s.secondary} onClick={()=>{clear();setStep(1);}}>Change activities</button></div>
  </section>}
 </section>;
}
