"use client";
import type {ObservationFields as Fields} from "../../domains/observations/contracts";
import styles from "../planner/planner.module.css";
export const kindLabels:Record<Fields["kind"],string>={POSITIVE:"Positive observation",LEARNING_SUPPORT:"Learning support",BEHAVIOUR_SUPPORT:"Behaviour support"};
export default function ObservationFields({fields,today,disabled,onChange}:{fields:Fields;today:string;disabled:boolean;onChange:(fields:Fields)=>void}){
 const change=(key:keyof Fields,value:string|null)=>onChange({...fields,[key]:value});
 return <fieldset disabled={disabled} className={styles.editor}><div className={styles.grid}>
 <label>Purpose<select value={fields.kind} onChange={e=>change("kind",e.target.value)}>{Object.entries(kindLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
 <label>Observation date<input type="date" min="1900-01-01" max={today} value={fields.observedDate} onChange={e=>change("observedDate",e.target.value)}/></label></div>
 <label>Classroom context<input maxLength={160} placeholder="For example: group reading activity" value={fields.context} onChange={e=>change("context",e.target.value)}/></label>
 <label>What did you observe?<textarea rows={5} maxLength={3000} placeholder="Describe what happened or what the learner did, using specific examples." value={fields.evidence} onChange={e=>change("evidence",e.target.value)}/></label>
 <label>Support or response provided (optional)<textarea rows={3} maxLength={2000} value={fields.response} onChange={e=>change("response",e.target.value)}/></label>
 <label>Next step (optional)<textarea rows={3} maxLength={2000} value={fields.nextStep} onChange={e=>change("nextStep",e.target.value)}/></label>
 <label>Follow-up date (optional)<input type="date" min={fields.observedDate} max="2200-12-31" value={fields.followUpDate??""} onChange={e=>change("followUpDate",e.target.value||null)}/></label></fieldset>;
}
