/** Internal school-finance arithmetic, not an authorization or settlement authority.
 * Pilot currency is ZAR; all amounts are integer cents carried as decimal strings.
 * Do not use these helpers to trust browser-supplied verification or balances.
 */
export const MAX_MINOR_UNITS=9223372036854775807n;
export class SchoolFinanceError extends Error {}
export function minorUnits(value:string):bigint{
 if(typeof value!=='string'||!/^(0|[1-9][0-9]{0,18})$/.test(value))throw new SchoolFinanceError('INVALID_MINOR_UNITS');
 const amount=BigInt(value);if(amount>MAX_MINOR_UNITS)throw new SchoolFinanceError('AMOUNT_OVERFLOW');return amount;
}
function checked(value:bigint):string{if(value<0n||value>MAX_MINOR_UNITS)throw new SchoolFinanceError('AMOUNT_OVERFLOW');return value.toString();}
export function invoiceTotal(lines:ReadonlyArray<{quantity:number;unitPriceMinor:string}>):string{
 if(!lines.length||lines.length>100)throw new SchoolFinanceError('INVALID_INVOICE_LINES');
 let total=0n;for(const line of lines){if(!Number.isSafeInteger(line.quantity)||line.quantity<1||line.quantity>10000)throw new SchoolFinanceError('INVALID_QUANTITY');total+=minorUnits(line.unitPriceMinor)*BigInt(line.quantity);checked(total);}
 if(total===0n)throw new SchoolFinanceError('INVOICE_TOTAL_REQUIRED');return checked(total);
}
export function splitInstalments(totalMinor:string,count:number):string[]{
 const total=minorUnits(totalMinor);if(!Number.isSafeInteger(count)||count<1||count>60||total<BigInt(count))throw new SchoolFinanceError('INVALID_INSTALMENT_COUNT');
 const base=total/BigInt(count),remainder=total%BigInt(count);
 return Array.from({length:count},(_,i)=>checked(base+(BigInt(i)<remainder?1n:0n)));
}
export type AllocationFacts={schoolId:string;accountId:string;currency:'ZAR'};
export function planVerifiedAllocation(
 payment:AllocationFacts&{verification:'REPORTED'|'VERIFIED'|'REJECTED';amountMinor:string;availableMinor:string},
 invoice:AllocationFacts&{status:'ISSUED'|'DISPUTED'|'VOID';totalMinor:string;outstandingMinor:string},
 requestedMinor:string,
){
 if(payment.schoolId!==invoice.schoolId||payment.accountId!==invoice.accountId||payment.currency!==invoice.currency)throw new SchoolFinanceError('ALLOCATION_SCOPE_MISMATCH');
 if(payment.currency!=='ZAR')throw new SchoolFinanceError('CURRENCY_NOT_SUPPORTED');
 if(payment.verification!=='VERIFIED')throw new SchoolFinanceError('VERIFIED_PAYMENT_REQUIRED');
 if(invoice.status!=='ISSUED')throw new SchoolFinanceError('INVOICE_NOT_ALLOCATABLE');
 const amount=minorUnits(payment.amountMinor),available=minorUnits(payment.availableMinor),total=minorUnits(invoice.totalMinor),outstanding=minorUnits(invoice.outstandingMinor),requested=minorUnits(requestedMinor);
 if(available>amount||outstanding>total)throw new SchoolFinanceError('INCONSISTENT_BALANCE');
 if(requested===0n||requested>available||requested>outstanding)throw new SchoolFinanceError('INVALID_ALLOCATION_AMOUNT');
 return {allocatedMinor:requested.toString(),paymentAvailableAfter:checked(available-requested),invoiceOutstandingAfter:checked(outstanding-requested)};
}
