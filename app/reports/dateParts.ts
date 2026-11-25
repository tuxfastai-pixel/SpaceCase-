export type DateParts={year:string;month:string;day:string};
export type DatePart=keyof DateParts;
export const emptyDateParts=():DateParts=>({year:'',month:'',day:''});
export function splitDate(value:string):DateParts{const [year='',month='',day='']=value.split('-');return {year,month,day};}
export function completeDate(parts:DateParts){return parts.year.length===4&&parts.month.length===2&&parts.day.length===2?`${parts.year}-${parts.month}-${parts.day}`:'';}
export function enterDatePart(parts:DateParts,part:DatePart,text:string){
 const size=part==='year'?4:2,digits=text.replace(/\D/g,'').slice(0,size),next={...parts,[part]:digits};
 const advance:DatePart|null=part==='year'&&digits.length===4?'month':part==='month'&&/^(0[1-9]|1[0-2])$/.test(digits)?'day':null;
 return {parts:next,advance};
}
export function pastedDate(text:string):DateParts|null{const value=text.trim();if(!/^(\d{4}-\d{2}-\d{2}|\d{4}\/\d{2}\/\d{2}|\d{8})$/.test(value))return null;const digits=value.replace(/\D/g,'');return {year:digits.slice(0,4),month:digits.slice(4,6),day:digits.slice(6,8)};}
export function dateInputError(parts:DateParts,min?:string,max?:string){const value=completeDate(parts);if(!value)return parts.year||parts.month||parts.day?'Complete the date: enter the year, month and day.':'';const date=new Date(`${value}T00:00:00Z`);if(Number(parts.year)<1||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)return 'Enter a real calendar date.';if(min&&value<min)return `Choose a date on or after ${min.replace(/-/g,'/')}.`;if(max&&value>max)return `Choose a date on or before ${max.replace(/-/g,'/')}.`;return '';}
