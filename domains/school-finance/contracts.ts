import {z} from 'zod';import {minorUnits,SchoolFinanceError} from './money';
export const financeId=z.string().uuid().transform(v=>v.toLowerCase());
export const moneyInput=z.string().refine(value=>{try{return minorUnits(value)>0n;}catch{return false;}},'Use positive integer cents');
export const financeDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v&&v>='1900-01-01'&&v<='2200-12-31';},'Use a real calendar date');
export const invoiceLine=z.object({description:z.string().trim().min(1).max(120).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/),quantity:z.number().int().min(1).max(10000),unitPriceMinor:z.string().refine(value=>{try{minorUnits(value);return true;}catch{return false;}},'Use integer cents')}).strict();
const revision=z.number().int().positive(),reason=z.string().trim().min(3).max(500).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/);
export const financeCommand=z.discriminatedUnion('action',[
 z.object({action:z.literal('CREATE_ACCOUNT'),learnerPersonId:financeId}).strict(),
 z.object({action:z.literal('CREATE_INVOICE'),requestKey:financeId,accountId:financeId,dueDate:financeDate,lines:z.array(invoiceLine).min(1).max(100)}).strict(),
 z.object({action:z.literal('ISSUE_INVOICE'),invoiceId:financeId,revision,reason}).strict(),
 z.object({action:z.literal('VOID_INVOICE'),invoiceId:financeId,revision,reason}).strict(),
 z.object({action:z.literal('DISPUTE_INVOICE'),invoiceId:financeId,revision,reason}).strict(),
 z.object({action:z.literal('RESOLVE_DISPUTE'),invoiceId:financeId,revision,reason}).strict(),
 z.object({action:z.literal('REPORT_PAYMENT'),requestKey:financeId,accountId:financeId,reference:z.string().trim().min(2).max(120).regex(/^[^\u0000-\u001f\u007f]+$/),amountMinor:moneyInput,receivedOn:financeDate,method:z.enum(['EFT','CASH','OTHER'])}).strict(),
 z.object({action:z.literal('VERIFY_PAYMENT'),paymentId:financeId,revision,reason,checkedAgainstSchoolRecords:z.literal(true)}).strict(),
 z.object({action:z.literal('REJECT_PAYMENT'),paymentId:financeId,revision,reason}).strict(),
 z.object({action:z.literal('ALLOCATE_PAYMENT'),requestKey:financeId,accountId:financeId,paymentId:financeId,invoiceId:financeId,amountMinor:moneyInput}).strict(),
]);
export type FinanceCommand=z.infer<typeof financeCommand>;
export type FinanceContext={personId:string;schoolId:string;displayName:string;principal:boolean;learner:{personId:string;admissionNumber:string}|null};
export class FinanceError extends SchoolFinanceError{constructor(public readonly code:string,public readonly status=403){super(code);}}
export function assertFinanceContext(context:FinanceContext,schoolId:string){if(!financeId.safeParse(context.personId).success||!financeId.safeParse(context.schoolId).success||typeof context.principal!=='boolean'||context.schoolId!==schoolId)throw new FinanceError('FINANCE_AUTHORITY_UNAVAILABLE',503);}
export function assertPrincipalApproval(context:FinanceContext){if(!context.principal)throw new FinanceError('FINANCE_PRINCIPAL_REQUIRED');}

const unsigned=z.string().regex(/^(0|[1-9][0-9]*)$/).max(40);
export const financeContextSchema=z.object({personId:financeId,schoolId:financeId,displayName:z.string(),principal:z.boolean(),learner:z.object({personId:financeId,admissionNumber:z.string()}).nullable()});
export const financeSchoolsSchema=z.object({personId:financeId,schools:z.array(z.object({id:financeId,displayName:z.string(),principal:z.boolean()})).max(200)});
export const financeLearnersSchema=z.object({learners:z.array(z.object({personId:financeId,admissionNumber:z.string(),givenName:z.string(),familyName:z.string()})).max(50),nextOffset:z.number().int().nonnegative().nullable()});
export const financeReadSchema=z.object({authority:financeContextSchema,accounts:z.array(z.object({id:financeId,learnerReference:z.string(),createdAt:z.string()})).max(50),nextOffset:z.number().int().nonnegative().nullable(),summary:z.object({accountCount:unsigned,invoicedMinor:unsigned,outstandingMinor:unsigned,draftCount:unsigned}),currency:z.literal('ZAR'),collectionEnabled:z.literal(false),taxInvoiceEnabled:z.literal(false),asOf:z.string(),ledger:z.object({accountId:financeId,invoices:z.array(z.object({id:financeId,reference:z.string(),status:z.enum(['DRAFT','ISSUED','DISPUTED','VOID']),totalMinor:unsigned,dueDate:z.string(),lines:z.array(invoiceLine),revision:z.number().int().positive(),createdBy:financeId,issuedBy:financeId.nullable(),createdAt:z.string(),allocatedMinor:unsigned})).max(100),invoicesTruncated:z.boolean(),payments:z.array(z.object({id:financeId,reference:z.string(),status:z.enum(['REPORTED','VERIFIED','REJECTED']),amountMinor:unsigned,receivedOn:z.string(),method:z.enum(['EFT','CASH','OTHER']),revision:z.number().int().positive(),recordedBy:financeId,reviewedBy:financeId.nullable(),reviewReason:z.string(),createdAt:z.string(),allocatedMinor:unsigned})).max(100),paymentsTruncated:z.boolean(),balances:z.object({invoicedMinor:unsigned,allocatedMinor:unsigned,unallocatedVerifiedMinor:unsigned})}).nullable()});
export type FinanceRead=z.infer<typeof financeReadSchema>;

export const financeMutationSchema=z.object({accountId:financeId.optional(),invoiceId:financeId.optional(),paymentId:financeId.optional(),allocationId:financeId.optional(),reused:z.boolean().optional()}).refine(v=>Boolean(v.accountId||v.invoiceId||v.paymentId||v.allocationId),'Expected a recorded resource');
export type FinanceMutationResult=z.infer<typeof financeMutationSchema>;
