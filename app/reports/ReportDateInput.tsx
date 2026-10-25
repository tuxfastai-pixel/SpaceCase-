'use client';
import {useEffect,useId,useRef,useState} from 'react';
import styles from './reports.module.css';
type Parts={year:string;month:string;day:string};
const empty:Parts={year:'',month:'',day:''};
export default function ReportDateInput({label,value,onChange,required=true}:{label:string;value:string;onChange:(value:string)=>void;required?:boolean}){
 const [parts,setParts]=useState<Parts>(()=>value?split(value):empty);
 const [calendarAvailable,setCalendarAvailable]=useState(false);
 const month=useRef<HTMLInputElement>(null),day=useRef<HTMLInputElement>(null),calendar=useRef<HTMLInputElement>(null);
 const hint=useId();
 useEffect(()=>{setCalendarAvailable(typeof calendar.current?.showPicker==='function');},[]);
 function update(next:Parts){setParts(next);onChange(next.year.length===4&&next.month.length===2&&next.day.length===2?`${next.year}-${next.month}-${next.day}`:'');}
 function enter(part:keyof Parts,text:string){const size=part==='year'?4:2;const digits=text.replace(/\D/g,'').slice(0,size);update({...parts,[part]:digits});if(digits.length===size){const next=part==='year'?month.current:part==='month'?day.current:null;next?.focus();next?.select();}}
 function paste(e:React.ClipboardEvent<HTMLInputElement>){const match=/^(\d{4})[-/](\d{2})[-/](\d{2})$/.exec(e.clipboardData.getData('text').trim());if(match){e.preventDefault();update({year:match[1],month:match[2],day:match[3]});day.current?.focus();}}
 return <div className={styles.dateField} role='group' aria-label={label}><span>{label}</span><div className={styles.dateParts}>
 <input aria-label={`${label} year`} aria-describedby={hint} placeholder='YYYY' inputMode='numeric' autoComplete='off' required={required} maxLength={4} pattern='[0-9]{4}' value={parts.year} onPaste={paste} onFocus={e=>e.target.select()} onChange={e=>enter('year',e.target.value)}/><span aria-hidden='true'>/</span>
 <input ref={month} aria-label={`${label} month`} placeholder='MM' inputMode='numeric' autoComplete='off' required={required} maxLength={2} pattern='(0[1-9]|1[0-2])' value={parts.month} onPaste={paste} onFocus={e=>e.target.select()} onChange={e=>enter('month',e.target.value)}/><span aria-hidden='true'>/</span>
 <input ref={day} aria-label={`${label} day`} placeholder='DD' inputMode='numeric' autoComplete='off' required={required} maxLength={2} pattern='(0[1-9]|[12][0-9]|3[01])' value={parts.day} onPaste={paste} onFocus={e=>e.target.select()} onChange={e=>enter('day',e.target.value)}/>
 {calendarAvailable?<button type='button' aria-label={`Choose ${label.toLowerCase()} date from calendar`} onClick={()=>calendar.current?.showPicker()}>Calendar</button>:null}
 <input ref={calendar} className={styles.calendarInput} type='date' tabIndex={-1} aria-hidden='true' value={value} onChange={e=>{if(e.target.value)update(split(e.target.value));}}/>
 </div><small id={hint}>YYYY / MM / DD</small></div>;
}
function split(value:string):Parts{const [year='',month='',day='']=value.split('-');return {year,month,day};}
