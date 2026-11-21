import {z} from 'zod';
import {peosRead} from '../support/authority';
import {familyFinanceEnabled,listBillingScopes} from './billingAuthority';
import {familyInvitationsEnabled} from './invitationConfig';
import {familyPlansEnabled} from './activityPlanHttp';
import {familyBillingDirectory} from './billingContracts';
export const familyConnectionsSchema=z.object({connections:z.array(z.object({id:z.string().uuid(),schoolName:z.string(),relationship:z.enum(['PARENT','GUARDIAN','CAREGIVER']),status:z.enum(['PENDING_SCHOOL_REVIEW','CONFIRMED','DECLINED','REVOKED','EXPIRED','UNAVAILABLE']),requestedAt:z.string().datetime(),reviewedAt:z.string().datetime().nullable(),grantsLearnerAccess:z.literal(false)})).max(100),nextOffset:z.number().int().nonnegative().nullable()});
import {type ParentHomeState} from './homeContracts';
type Connections=z.infer<typeof familyConnectionsSchema>;type Directory=z.infer<typeof familyBillingDirectory>;
export function parentHomeState(input:{connections:Connections|null;directory:Directory|null;plansEnabled:boolean;incomplete:boolean},now=Date.now()):ParentHomeState{
 const scopes=input.directory?.scopes.filter(s=>Date.parse(s.expiresAt)>now)??[],rows=input.connections?.connections??[];
 const canOpenAccount=scopes.length>0,confirmed=rows.some(r=>r.status==='CONFIRMED'),waiting=rows.some(r=>r.status==='PENDING_SCHOOL_REVIEW');
 return {stage:canOpenAccount?'READY':confirmed?'CONNECTED':waiting?'WAITING':rows.length?'ATTENTION':input.incomplete?'UNAVAILABLE':'START',schools:[...new Set([...scopes.map(s=>s.schoolName),...rows.filter(r=>['CONFIRMED','PENDING_SCHOOL_REVIEW'].includes(r.status)).map(r=>r.schoolName)])],learners:scopes.map(s=>({name:`${s.givenName} ${s.familyName}`.trim(),schoolName:s.schoolName,reference:s.learnerReference,canPlan:input.plansEnabled&&s.actions.includes('family.finance.plan.accept')})),canOpenAccount,canPlan:input.plansEnabled&&scopes.some(s=>s.actions.includes('family.finance.plan.accept')),accessCheckIncomplete:input.incomplete,hasSchoolHistory:rows.length>0||canOpenAccount,moreAvailable:Boolean(input.directory?.truncated||input.connections?.nextOffset!==null&&input.connections?.nextOffset!==undefined)};
}
export async function readParentHome(request:Request,deps={connections:()=>peosRead(request,'/v1/family/connections?offset=0',familyConnectionsSchema),directory:()=>listBillingScopes(request),connectionsEnabled:familyInvitationsEnabled(),financeEnabled:familyFinanceEnabled(),plansEnabled:familyPlansEnabled()}){
 const [connections,directory]=await Promise.allSettled([deps.connectionsEnabled?deps.connections():Promise.resolve(null),deps.financeEnabled?deps.directory():Promise.resolve(null)]);
 return parentHomeState({connections:connections.status==='fulfilled'?connections.value:null,directory:directory.status==='fulfilled'?directory.value:null,plansEnabled:deps.plansEnabled,incomplete:connections.status==='rejected'||directory.status==='rejected'});
}
/** Discovery only: never routes a current staff member away from their assigned workspace. */
export function parentLandingDestination(staffSchoolCount:number,home:ParentHomeState):'/parent'|null{return staffSchoolCount===0&&home.hasSchoolHistory?'/parent':null;}
