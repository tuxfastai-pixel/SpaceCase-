import {financeOverview} from './overview';
import {formatZar} from './forms';
import {FinanceIcon} from './FinanceUi';
import {auditActionLabel,financeDateLabel} from './presentation';
import type {FinanceAction} from '../../platform/finance/peosAuthorization';
import s from './finance.module.css';
type Props={
 actions:FinanceAction[];personId:string;intakeEnabled:boolean;truncated?:boolean;
 invoices?:{id:string;invoiceNumber:string;status:string;amountMinor:string;allocatedMinor:string}[];
 payments?:{verification:string;preparedBy:string;amountMinor:string;allocatedMinor:string}[];
 audit?:{action:string;occurredAt:string}[]|null;
 open:(section:string,anchor?:string)=>void;
};
export default function FinanceOverview({actions,personId,intakeEnabled,truncated,invoices,payments,audit,open}:Props){
 const can=(action:FinanceAction)=>actions.includes(action);
 const {awaiting,reviewable,available,outstanding}=financeOverview(invoices,payments,personId);
 return <div id='finance-panel-home' tabIndex={-1}>
  <section className={s.welcome} aria-labelledby='finance-overview-title'>
   <p className={s.eyebrow}>Your finance workspace</p><h2 id='finance-overview-title' tabIndex={-1}>What would you like to do?</h2>
   <p>Start a task below, or use the menu to find your records.</p>
   <div className={s.taskGrid}>
    {intakeEnabled&&can('finance.transactions.record')&&<button onClick={()=>open('intake')}><FinanceIcon name='import'/><span>Bring in a statement<small>Choose a CSV, check the entries, then import.</small></span><FinanceIcon name='next'/></button>}
    {can('finance.transactions.record')&&<button onClick={()=>open('accounts','finance-create-invoice')}><FinanceIcon name='file'/><span>Create a fee invoice<small>Find the learner and enter the fees.</small></span><FinanceIcon name='next'/></button>}
    <button onClick={()=>open('accounts','finance-receipt-register')}><FinanceIcon name='receipts'/><span>Find a receipt<small>Check its verification and available balance.</small></span><FinanceIcon name='next'/></button>
   </div>
  </section>
  <div className={s.overviewColumns}>
   <section className={s.card} aria-labelledby='finance-attention-title'>
    <h2 id='finance-attention-title'><FinanceIcon name='review'/> Next steps</h2>
    <p className={s.note}>Based on the latest loaded records{truncated?' — up to 100 per category':''}. Refresh records to check for updates.</p>
    {awaiting!==null&&<div className={s.taskRow}><div><strong>{awaiting} receipts awaiting verification</strong><p>{can('finance.payments.verify')?`${reviewable} can be reviewed by you. Records you captured need another reviewer.`:'An authorized colleague checks the payment evidence before allocation.'}</p></div><button className={s.secondary} onClick={()=>open(can('finance.payments.verify')?'review':'accounts',can('finance.payments.verify')?'finance-independent-review':'finance-receipt-register')}>{can('finance.payments.verify')?'View checks':'View receipts'}</button></div>}
    {available!==null&&<div className={s.taskRow}><div><strong>{available} verified receipts with money to allocate</strong><p>Match a verified receipt to the correct learner’s invoice.</p></div><button className={s.secondary} onClick={()=>open('accounts',can('finance.transactions.record')?'finance-allocate-receipt':'finance-receipt-register')}>{can('finance.transactions.record')?'Allocate a receipt':'View receipts'}</button></div>}
    {awaiting===null&&<p>Receipt details are not included in your current view.</p>}
   </section>
   <section className={s.card} aria-labelledby='finance-outstanding-title'>
    <h2 id='finance-outstanding-title'>Outstanding fees</h2><p className={s.note}>Invoices with an unpaid balance in the loaded records.</p>
    {outstanding===undefined?<p>Invoice details are not included in your current view.</p>:outstanding.length?<ul className={s.overviewList}>{outstanding.slice(0,4).map(i=><li key={i.id}><span>{i.invoiceNumber}</span><strong>{formatZar((BigInt(i.amountMinor)-BigInt(i.allocatedMinor)).toString())}</strong></li>)}</ul>:<p>No outstanding fees in the loaded invoices.</p>}
    <button className={s.secondary} onClick={()=>open('accounts','finance-fee-invoices')}>View fee invoices<FinanceIcon name='next'/></button>
   </section>
  </div>
  {audit&&<section className={s.card} aria-labelledby='finance-recent-title'><h2 id='finance-recent-title'>Recent activity</h2>{audit.length?<ul className={s.overviewList}>{audit.slice(0,3).map((row,index)=><li key={`${row.occurredAt}-${index}`}><span>{auditActionLabel(row.action)}</span><time dateTime={row.occurredAt}>{financeDateLabel(row.occurredAt)}</time></li>)}</ul>:<p>No activity in the loaded history.</p>}<button className={s.secondary} onClick={()=>open('audit')}>View audit trail<FinanceIcon name='next'/></button></section>}
  <details className={s.details}><summary>How receipts work</summary><p>Import a statement → capture a receipt → have a different authorized colleague verify it → allocate it to an invoice. Importing alone does not confirm a payment or reduce outstanding fees.</p></details>
 </div>;
}
