'use client';
import {useState,useEffect,useRef,type FormEvent} from 'react';
import {activityBalances,distributeContribution,contributionSchedule,deadlineShortfalls,type ContributionMode} from '../../domains/school-activities/contributions';
import {formatZar,randToMinor} from './forms';
import {financeDateLabel} from './presentation';
import {FinanceIcon} from './FinanceUi';
import s from './finance.module.css';
type DraftActivity={id:string;title:string;deadline:string;amount:string;chosen:string};
type Preview={distribution:ReturnType<typeof distributeContribution>;schedule:ReturnType<typeof contributionSchedule>;shortfalls:ReturnType<typeof deadlineShortfalls>;total:string;flexi:boolean};
export default function ActivityPlanning(){
 const [events,setEvents]=useState<DraftActivity[]>([{id:'activity-1',title:'',deadline:'',amount:'',chosen:''}]);
 const [nextId,setNextId]=useState(2),[contribution,setContribution]=useState(''),[mode,setMode]=useState<ContributionMode>('EARLIEST');
 const [flexi,setFlexi]=useState(false),[dates,setDates]=useState([{date:'',amount:''}]),[variable,setVariable]=useState(false);
 const previewRef=useRef<HTMLElement>(null);
 const [preview,setPreview]=useState<Preview|null>(null),[error,setError]=useState('');
 useEffect(()=>{if(!preview)return;const target=previewRef.current;target?.scrollIntoView({block:'start',behavior:'auto'});target?.focus({preventScroll:true});target?.classList.add(s.recordHighlight);const timer=setTimeout(()=>target?.classList.remove(s.recordHighlight),4500);return()=>{clearTimeout(timer);target?.classList.remove(s.recordHighlight);};},[preview]);
 function clear(){setPreview(null);setError('');}
 function changeEvent(id:string,key:keyof Omit<DraftActivity,'id'>,value:string){clear();setEvents(rows=>rows.map(row=>row.id===id?{...row,[key]:value}:row));}
 function activities(){return events.map(row=>({id:row.id,title:row.title,deadline:row.deadline,amountMinor:randToMinor(row.amount),verifiedMinor:'0'}));}
 function preset(half:boolean){try{clear();const total=BigInt(activityBalances(activities()).outstandingMinor);const value=half?(total+1n)/2n:total;setContribution(`${value/100n}.${(value%100n).toString().padStart(2,'0')}`);}catch{setError('Add the activity names, prices and valid payment deadlines first.');}}
 function calculate(event:FormEvent){event.preventDefault();clear();try{
  const rows=activities(),total=activityBalances(rows).totalMinor;
  const chosen=Object.fromEntries(events.filter(row=>row.chosen.trim()).map(row=>[row.id,randToMinor(row.chosen)]));
  const distribution=distributeContribution(rows,randToMinor(contribution),mode,chosen);
  const schedule=flexi?[]:contributionSchedule(distribution.remainingMinor,dates.map(d=>d.date),variable?dates.map(d=>randToMinor(d.amount)):undefined);
  setPreview({distribution,schedule,shortfalls:deadlineShortfalls(distribution.rows,schedule),total,flexi});
 }catch(reason){setError(reason instanceof Error&&!['ZodError','SchoolFinanceError'].includes(reason.name)&&!/^([A-Z_]+)$/.test(reason.message)?reason.message:'Check the names, amounts and payment dates. Dates must be unique and in order.');}}
 return <section className={s.card} aria-labelledby='activity-planning-title'>
  <h2 id='activity-planning-title'><FinanceIcon name='budget'/> Plan activity contributions</h2>
  <p>Explore how a family could spread the cost of school activities.</p>
  <div className={s.softPanel}><strong>Planning preview</strong><p>Nothing here is saved to a parent account, charged or marked as paid. Use activity estimates only; parent commitments and payment-proof uploads are not connected yet.</p></div>
  <form onSubmit={calculate} data-guided-flow data-guide-step={preview?'preview':'choices'}>
   <fieldset className={s.planningFields}><legend>1. Which activities are included?</legend>
    <p className={s.note}>Enter the contribution for one learner and the date that money is needed. Optional activities will require a parent’s choice before any charge is created.</p>
    {events.map((row,index)=><div className={s.planningEvent} key={row.id}><h3>Activity {index+1}</h3><div className={s.planningGrid}>
     <label>Activity name<input required maxLength={160} value={row.title} onChange={e=>changeEvent(row.id,'title',e.target.value)}/></label>
     <label>Cost per learner (R)<input required inputMode='decimal' value={row.amount} onChange={e=>changeEvent(row.id,'amount',e.target.value)}/></label>
     <label>Money needed by<input type='date' required value={row.deadline} onChange={e=>changeEvent(row.id,'deadline',e.target.value)}/></label>
    </div>{events.length>1&&<button type='button' className={s.secondary} onClick={()=>{clear();setEvents(rows=>rows.filter(r=>r.id!==row.id));}}>Remove activity {index+1}</button>}</div>)}
    <button type='button' className={s.secondary} disabled={events.length>=20} onClick={()=>{clear();setEvents(rows=>[...rows,{id:`activity-${nextId}`,title:'',deadline:'',amount:'',chosen:''}]);setNextId(n=>n+1);}}>Add an activity</button>
   </fieldset>
   <fieldset className={s.planningFields}><legend>2. What could the parent contribute now?</legend>
    <div className={s.actions}><button type='button' className={s.secondary} onClick={()=>preset(true)}>Try half the total</button><button type='button' className={s.secondary} onClick={()=>preset(false)}>Try the full amount</button></div>
    <label className={s.form}>Contribution to explore (R)<input required inputMode='decimal' value={contribution} onChange={e=>{clear();setContribution(e.target.value);}}/></label>
    <label className={s.form}>How should it be spread?<select value={mode} onChange={e=>{clear();setMode(e.target.value as ContributionMode);}}><option value='EARLIEST'>Cover upcoming payment deadlines first</option><option value='SPREAD'>Spread in proportion to activity costs</option><option value='CUSTOM'>Choose the split myself</option></select></label>
    <details className={s.details} open={mode==='CUSTOM'}><summary>Choose an amount for a particular activity</summary><p>Chosen amounts stay as entered. Automatic spreading uses the other activities. Leave a field blank to let SpaceCase suggest its share.</p><div className={s.planningGrid}>{events.map((row,index)=><label key={row.id}>{row.title||`Activity ${index+1}`} — chosen amount (R)<input inputMode='decimal' value={row.chosen} onChange={e=>changeEvent(row.id,'chosen',e.target.value)}/></label>)}</div></details>
   </fieldset>
   <fieldset className={s.planningFields}><legend>3. How could the remaining amount be paid?</legend>
    <label><span><input type='checkbox' checked={flexi} onChange={e=>{clear();setFlexi(e.target.checked);}}/> Explore flexible contributions without fixed instalments</span></label>
    {flexi?<p>The outstanding amount still needs to be covered by each activity’s deadline. Flexi is not a promise that those deadlines will be met.</p>:<><p>Use the school’s approved dates: monthly, every two months, per term, half-yearly or custom. Term and half-year boundaries must come from the school’s calendar.</p>
     <label><span><input type='checkbox' checked={variable} onChange={e=>{clear();setVariable(e.target.checked);}}/> Choose different instalment amounts</span></label>
     {dates.map((row,index)=><div className={s.planningGrid} key={index}><label>Payment date {index+1}<input type='date' value={row.date} onChange={e=>{clear();setDates(rows=>rows.map((r,i)=>i===index?{...r,date:e.target.value}:r));}}/></label>{variable&&<label>Amount {index+1} (R)<input inputMode='decimal' value={row.amount} onChange={e=>{clear();setDates(rows=>rows.map((r,i)=>i===index?{...r,amount:e.target.value}:r));}}/></label>}{dates.length>1&&<button type='button' className={s.secondary} onClick={()=>{clear();setDates(rows=>rows.filter((_,i)=>i!==index));}}>Remove payment date {index+1}</button>}</div>)}
     <button type='button' className={s.secondary} disabled={dates.length>=60} onClick={()=>{clear();setDates(rows=>[...rows,{date:'',amount:''}]);}}>Add a payment date</button></>}
   </fieldset>
   {error&&<p role='alert' className={s.error}>{error}</p>}
   <button data-guide-next><FinanceIcon name='search'/>Preview the plan</button>
  </form>
  {preview&&<section ref={previewRef} className={s.wizard} aria-label='Activity contribution preview' tabIndex={-1}>
   <h3>Your proposed contribution plan</h3><p role='status'>Preview ready. Review the split and any deadline shortfalls below. This is not a payment confirmation.</p>
   <div className={s.summaryTiles}><div><span>Activities total</span><strong>{formatZar(preview.total)}</strong></div><div><span>Contribution being explored</span><strong>{formatZar(preview.distribution.contributionMinor)}</strong></div><div><span>Left after this proposed split</span><strong>{formatZar(preview.distribution.remainingMinor)}</strong></div></div>
   <div className={s.tableWrap}><table><caption>Where the contribution would go</caption><thead><tr><th>Activity</th><th>Money needed by</th><th>Proposed amount</th><th>Still needed</th></tr></thead><tbody>{preview.distribution.rows.map(row=><tr key={row.id}><td>{row.title}</td><td>{financeDateLabel(row.deadline)}</td><td>{formatZar(row.proposedMinor)}</td><td>{formatZar(row.remainingMinor)}</td></tr>)}</tbody></table></div>
   {preview.distribution.unassignedMinor!=='0'&&<p className={s.error}>{formatZar(preview.distribution.unassignedMinor)} is unassigned. Choose a split or reduce the contribution. No credit or donation has been created.</p>}
   {!!preview.shortfalls.length&&<div className={s.softPanel}><strong>Some deadlines need attention</strong><ul>{preview.shortfalls.map(row=><li key={row.deadline}>By {financeDateLabel(row.deadline)}, a further {formatZar(row.shortfallMinor)} would be needed beyond the payments scheduled by that date.</li>)}</ul></div>}
   {!!preview.schedule.length&&<><h3>Remaining instalments</h3><ul>{preview.schedule.map(row=><li key={row.dueDate}>{financeDateLabel(row.dueDate)} — {formatZar(row.amountMinor)}</li>)}</ul></>}
   <p>Parents will be able to add Flexi top-ups alongside an agreed plan. A top-up must be verified before balances change; a revised schedule will need explicit acceptance.</p>
  </section>}
 </section>;
}
