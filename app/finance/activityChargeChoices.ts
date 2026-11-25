export type ActivityInvoiceChoice={id:string;invoiceNumber:string;learnerId:string;amountMinor:string;dueDate:string;status:string};
export type SavedActivityLink={id:string;activityId:string;invoiceId:string;learnerId:string};
export function matchingActivityInvoices(invoices:ActivityInvoiceChoice[],activity:{id:string;status:string;details:{amountMinor:string;paymentDeadline:string}}|undefined,learnerId:string|undefined,links:SavedActivityLink[]){
 if(!activity||activity.status!=='PUBLISHED'||!learnerId)return [];
 return invoices.filter(i=>i.learnerId===learnerId&&i.status==='ISSUED'&&i.amountMinor===activity.details.amountMinor&&i.dueDate===activity.details.paymentDeadline&&!links.some(link=>link.invoiceId===i.id&&link.activityId!==activity.id));
}
