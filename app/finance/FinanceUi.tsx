import type {FinanceIconName} from './presentation';
import {financeStatus} from './presentation';
import s from './finance.module.css';
const paths:Record<FinanceIconName,string>={
 receipts:'M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 4h6M9 11h6M9 15h3',
 import:'M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5',
 budget:'M3 7h18v13H3V7Zm0 4h18M7 3v4m10-4v4M7 15h3m4 0h3',
 review:'M9 4h6v3H9V4Zm-2 1H5v16h14V5h-2M8 13l3 3 5-6',
 audit:'M5 3h10l4 4v14H5V3Zm9 0v5h5M8 12h8m-8 4h6',
 refresh:'M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5m-4 8a8 8 0 0 0 14 3l3-3m0 5v-5h-5',
 download:'M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4',
 print:'M7 8V3h10v5M7 17H3V8h18v9h-4M7 14h10v7H7v-7Z',
 check:'m5 12 4 4L19 6',help:'M9 9a3 3 0 1 1 4 3c-1 .5-1 1-1 3m0 3h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
 back:'m14 5-7 7 7 7',next:'m10 5 7 7-7 7',file:'M5 3h9l5 5v13H5V3Zm9 0v6h5',
 team:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-4M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm5-3a4 4 0 0 1 0 7',
 exit:'M9 4H3v16h6m5-13 5 5-5 5m-7-5h12',warning:'m12 3 10 18H2L12 3Zm0 6v5m0 3h.01',search:'m21 21-5-5m2-6a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
};
export function FinanceIcon({name}:{name:FinanceIconName}){return <svg className={s.icon} width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.7' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true' focusable='false'><path d={paths[name]}/></svg>;}
export function FinanceStatus({value,context='ledger'}:{value:string;context?:'ledger'|'intake'}){
 const tone=['APPROVED','VERIFIED'].includes(value)?'positive':['DUPLICATE_REVIEW','REJECTED','DISPUTED'].includes(value)?'attention':['DISMISSED','VOID'].includes(value)?'muted':'neutral';
 return <span className={`${s.badge} ${s[tone]}`}>{financeStatus(value,context)}</span>;
}
