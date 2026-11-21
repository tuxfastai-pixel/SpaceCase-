import type {RegisterData} from '../../domains/school-activities/registerContracts';
type Calendar=RegisterData['calendars'][number];
/** New activities use one latest option per year; an existing draft keeps its exact saved version. */
export function activityYearChoices(calendars:Calendar[],selectedId=''){
 const latest=new Map<number,Calendar>();for(const c of calendars){const prior=latest.get(c.year);if(!prior||c.version>prior.version)latest.set(c.year,c);}
 const rows=[...latest.values()],selected=calendars.find(c=>c.id===selectedId);if(selected&&!rows.some(c=>c.id===selected.id))rows.push(selected);
 return rows.sort((a,b)=>b.year-a.year||b.version-a.version||a.id.localeCompare(b.id));
}
export function resolveActivityYear(current:string,calendars:Calendar[]){
 // Keep a missing reference unresolved until the user chooses; repeated refreshes must not remap it.
 if(current)return current;
 const choices=activityYearChoices(calendars);return choices.length===1?choices[0].id:'';
}
