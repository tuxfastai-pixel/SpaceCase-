'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {completeDate,dateInputError,emptyDateParts,enterDatePart,pastedDate,splitDate,type DatePart,type DateParts} from './dateParts';
import styles from './reports.module.css';
export default function ReportDateInput({label,value,onChange,required=true,name,min,max,resetKey}:{label:string;value:string;onChange:(value:string)=>void;required?:boolean;name?:string;min?:string;max?:string;resetKey?:string|number}){
 const [parts,setParts]=useState<DateParts>(()=>value?splitDate(value):emptyDateParts()),[calendarAvailable,setCalendarAvailable]=useState(false);
 const year=useRef<HTMLInputElement>(null),month=useRef<HTMLInputElement>(null),day=useRef<HTMLInputElement>(null),calendar=useRef<HTMLInputElement>(null),emitted=useRef(value),previousReset=useRef(resetKey);
 const hint=useId();
 useEffect(()=>{setCalendarAvailable(typeof calendar.current?.showPicker==='function');},[]);
 useEffect(()=>{if(value!==emitted.current||resetKey!==previousReset.current){setParts(value?splitDate(value):emptyDateParts());emitted.current=value;previousReset.current=resetKey;}},[value,resetKey]);
 useEffect(()=>{for(const input of [year.current,month.current,day.current])input?.setCustomValidity('');const target=parts.year.length!==4?year.current:parts.month.length!==2?month.current:day.current;target?.setCustomValidity(dateInputError(parts,min,max));},[parts,min,max]);
 function update(next:DateParts){setParts(next);emitted.current=completeDate(next);onChange(emitted.current);}
 function focus(part:DatePart){const input=part==='year'?year.current:part==='month'?month.current:day.current;input?.focus();input?.select();}
 function enter(part:DatePart,text:string){const result=enterDatePart(parts,part,text);update(result.parts);if(result.advance)focus(result.advance);}
 function paste(e:React.ClipboardEvent<HTMLInputElement>){const next=pastedDate(e.clipboardData.getData('text'));if(next){e.preventDefault();update(next);focus('day');}}
 function back(e:React.KeyboardEvent<HTMLInputElement>,part:DatePart){if(e.key==='Backspace'&&!e.currentTarget.value&&part!=='year'){e.preventDefault();focus(part==='day'?'month':'year');}}
 return <div className={styles.dateField} role='group' aria-label={label}><span>{label}</span><div className={styles.dateParts}>
 <input ref={year} data-guide-hint='Enter four year digits, then two month digits and two day digits. The cursor moves between parts automatically.' aria-label={`${label} year`} aria-describedby={hint} placeholder='YYYY' inputMode='numeric' autoComplete='off' required={required} maxLength={4} pattern='[0-9]{4}' value={parts.year} onPaste={paste} onFocus={e=>e.target.select()} onChange={e=>enter('year',e.target.value)}/><span aria-hidden='true'>/</span>
 <input ref={month} aria-label={`${label} month`} aria-describedby={hint} placeholder='MM' inputMode='numeric' autoComplete='off' required={required} maxLength={2} pattern='(0[1-9]|1[0-2])' value={parts.month} onPaste={paste} onKeyDown={e=>back(e,'month')} onFocus={e=>e.target.select()} onChange={e=>enter('month',e.target.value)}/><span aria-hidden='true'>/</span>
 <input ref={day} aria-label={`${label} day`} aria-describedby={hint} placeholder='DD' inputMode='numeric' autoComplete='off' required={required} maxLength={2} pattern='(0[1-9]|[12][0-9]|3[01])' value={parts.day} onPaste={paste} onKeyDown={e=>back(e,'day')} onFocus={e=>e.target.select()} onChange={e=>enter('day',e.target.value)}/>
 {calendarAvailable?<button type='button' aria-label={`Choose ${label.toLowerCase()} date from calendar`} onClick={()=>calendar.current?.showPicker()}>Calendar</button>:null}
 <input ref={calendar} className={styles.calendarInput} type='date' tabIndex={-1} aria-hidden='true' min={min} max={max} value={value} onChange={e=>{if(e.target.value)update(splitDate(e.target.value));}}/>
 </div>{name?<input type='hidden' name={name} value={value}/>:null}<small id={hint}>YYYY / MM / DD</small></div>;
}
