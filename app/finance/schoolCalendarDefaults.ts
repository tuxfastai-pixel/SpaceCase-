import type {CalendarPolicy} from '../../domains/school-activities/registerContracts';
export const schoolCalendarSources:Record<number,string>={
 2026:'https://www.education.gov.za/Portals/0/Documents/Publications/2025/Published%202026%20School%20Calendar.pdf',
 2027:'https://www.education.gov.za/Portals/0/Documents/Publications/2025/Published%202027%20School%20Calendar.pdf',
};
const terms:Record<number,[string,string][]>= {
 2026:[['2026-01-14','2026-03-27'],['2026-04-08','2026-06-26'],['2026-07-21','2026-09-23'],['2026-10-06','2026-12-09']],
 2027:[['2027-01-13','2027-03-19'],['2027-04-06','2027-06-25'],['2027-07-20','2027-09-22'],['2027-10-05','2027-12-08']],
};
/** Published learner dates; half-years are editable groupings, not gazetted dates. */
export function schoolCalendarDefault(year:number):CalendarPolicy|null{
 const dates=terms[year];if(!dates)return null;
 return {label:`${year} school year`,start:dates[0][0],end:dates[3][1],terms:dates.map(([start,end])=>({start,end})),halves:[{start:dates[0][0],end:dates[1][1]},{start:dates[2][0],end:dates[3][1]}],paymentOptions:['MONTHLY','TERM','HALF_YEAR','FLEXI'],minimumMinor:'0'};
}
