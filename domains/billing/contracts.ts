import {z} from "zod";
import {id} from "../support/contracts";
const reference=z.string().trim().min(3).max(80).regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/);
const cents=z.number().int().min(1).max(1000000000);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+"T00:00:00Z");return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===v;});
const reason=z.string().trim().min(10).max(500).regex(/^[^\u0000-\u001f\u007f]*$/);
export const billingAction=z.discriminatedUnion("action",[
 z.object({action:z.literal("RECORD_INVOICE"),id,schoolId:id,reference,amountCents:cents,dueDate:date,reason}).strict(),
 z.object({action:z.literal("RECORD_RECEIPT"),id,invoiceId:id,reference,amountCents:cents,paidOn:date,verified:z.literal(true),reason}).strict(),
 z.object({action:z.literal("VOID_INVOICE"),invoiceId:id,reason}).strict(),
 z.object({action:z.literal("SET_DISPUTE"),invoiceId:id,disputed:z.boolean(),reason}).strict(),
 z.object({action:z.literal("REVERSE_RECEIPT"),invoiceId:id,receiptId:id,reason}).strict(),
]);
export type BillingAction=z.infer<typeof billingAction>;
export function invoiceState(invoice:{voided:boolean;disputed:boolean;amountCents:number;paidCents:number;dueDate:string},today:string){
 if(invoice.voided)return "VOID";
 if(invoice.disputed)return "DISPUTED";
 if(invoice.paidCents>=invoice.amountCents)return "PAID";
 if(invoice.dueDate<today)return invoice.paidCents>0?"OVERDUE_PART_PAID":"OVERDUE";
 return invoice.paidCents>0?"PART_PAID":"DUE";
}
