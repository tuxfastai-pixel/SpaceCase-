import {z} from 'zod';
import {sourceCharge,type FamilyPlanCharge} from '../../../domains/school-activities/familyPlan';
import {distributeContribution} from '../../../domains/school-activities/contributions';
import {randToMinor} from '../../finance/forms';
/** Illustration of currently loaded authorised charges only; never a payment instruction or ledger write. */
export function previewFamilyContribution(charges:FamilyPlanCharge[],amount:string,mode:'EARLIEST'|'SPREAD',reserveId='',reserveAmount=''){
 const current=z.array(sourceCharge).min(1).max(100).parse(charges);
 let contribution:string;try{contribution=randToMinor(amount);}catch{throw Error('Enter an amount in rand, using up to two decimal places.');}
 if(BigInt(contribution)<=0n)throw Error('Enter an amount greater than zero.');
 const custom:Record<string,string>={};if(reserveId){if(!current.some(c=>c.chargeId===reserveId))throw Error('Choose an activity from the current list.');let reserved:string;try{reserved=randToMinor(reserveAmount);}catch{throw Error('Enter the amount to set aside, using up to two decimal places.');}if(BigInt(reserved)<=0n)throw Error('Set aside an amount greater than zero, or choose No set-aside.');custom[reserveId]=reserved;}
 return distributeContribution(current.map(c=>({id:c.chargeId,title:c.title,deadline:c.deadline,amountMinor:c.amountMinor,verifiedMinor:c.allocatedMinor})),contribution,mode,custom);
}
export function contributionPreset(charges:FamilyPlanCharge[],half:boolean){const current=z.array(sourceCharge).min(1).max(100).parse(charges);const total=current.reduce((n,c)=>n+BigInt(c.amountMinor)-BigInt(c.allocatedMinor),0n);if(total<=0n)throw Error('These activities have no remaining balance.');const amount=half?(total+1n)/2n:total;return `${amount/100n}.${String(amount%100n).padStart(2,'0')}`;}
