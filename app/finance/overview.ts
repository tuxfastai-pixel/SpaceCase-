type Invoice={id:string;invoiceNumber:string;status:string;amountMinor:string;allocatedMinor:string};
type Payment={verification:string;preparedBy:string;amountMinor:string;allocatedMinor:string};
export function financeOverview(invoices:Invoice[]|undefined,payments:Payment[]|undefined,personId:string){
 return {
  awaiting:payments?.filter(p=>p.verification==='REPORTED').length??null,
  reviewable:payments?.filter(p=>p.verification==='REPORTED'&&p.preparedBy!==personId).length??null,
  available:payments?.filter(p=>p.verification==='VERIFIED'&&BigInt(p.amountMinor)>BigInt(p.allocatedMinor)).length??null,
  outstanding:invoices?.filter(i=>i.status==='ISSUED'&&BigInt(i.amountMinor)>BigInt(i.allocatedMinor)),
 };
}
