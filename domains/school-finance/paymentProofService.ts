import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {Pool,PoolClient} from 'pg';
import {FamilyBillingError,type FamilyBillingDecision} from '../../platform/family/billingAuthority';
import {financeTransaction,financeAudit} from './workspaceService';
import {PaymentProofError,proofSubmission,proofQuarantinePolicy,quarantineFingerprint,type ProofSubmission,type ProofQuarantinePolicy} from './proofContracts';
type Authorize=(grantId:string)=>Promise<FamilyBillingDecision>;
function sameScope(original:FamilyBillingDecision,decision:FamilyBillingDecision){
 if(!decision.allowed||decision.contractVersion!=='family-billing-v1'||decision.action!=='family.finance.proof.submit'||Date.parse(decision.expiresAt)<=Date.now()||!Number.isFinite(Date.parse(decision.expiresAt))||['grantId','personId','schoolId','learnerPersonId'].some(key=>original[key as keyof FamilyBillingDecision]!==decision[key as keyof FamilyBillingDecision]))throw new FamilyBillingError(403,'FAMILY_BILLING_FORBIDDEN');
}
async function scopeFor(grantId:string,authorize:Authorize){const id=z.string().uuid().toLowerCase().parse(grantId),scope=await authorize(id);sameScope(scope,scope);if(scope.grantId!==id)throw new FamilyBillingError(403,'FAMILY_BILLING_FORBIDDEN');return scope;}
async function accountFor(db:PoolClient,scope:FamilyBillingDecision,lock:boolean){const result=await db.query(`SELECT id, (now() AT TIME ZONE 'Africa/Johannesburg')::date::text AS today FROM school_finance.accounts WHERE peos_school_id=$1 AND status='ACTIVE' ${lock?'FOR UPDATE':''}`,[scope.schoolId]);if(result.rowCount!==1)throw new FamilyBillingError(404,'FAMILY_ACCOUNT_UNAVAILABLE');return result.rows[0] as {id:string;today:string};}
const summarySql=`SELECT p.id,p.amount_minor::text AS "amountMinor",p.paid_on::text AS "paidOn",p.payment_reference AS reference,p.method,p.received_at::text AS "receivedAt",COALESCE(c.expires_at,p.expires_at)::text AS "expiresAt",CASE WHEN c.expires_at>clock_timestamp() AND EXISTS(SELECT 1 FROM school_finance.payment_proof_cleared_files f WHERE f.proof_id=c.proof_id AND f.account_id=c.account_id) THEN 'READY_FOR_REVIEW' WHEN EXISTS(SELECT 1 FROM school_finance.payment_proof_scan_attempts s WHERE s.proof_id=p.id AND s.account_id=p.account_id AND s.outcome='BLOCKED') THEN 'FILE_BLOCKED' WHEN p.expires_at<=clock_timestamp() OR EXISTS(SELECT 1 FROM school_finance.payment_proof_scan_attempts s WHERE s.proof_id=p.id AND s.account_id=p.account_id AND s.outcome='CLEARED') THEN 'EXPIRED' ELSE 'QUARANTINED' END AS status FROM school_finance.payment_proof_cases p LEFT JOIN school_finance.payment_proof_cleared c ON c.proof_id=p.id AND c.account_id=p.account_id`;
async function summary(db:PoolClient,id:string,accountId:string,scope:FamilyBillingDecision){const result=await db.query(`${summarySql} WHERE p.id=$1 AND p.account_id=$2 AND p.actor_person_id=$3 AND p.learner_person_id=$4`,[id,accountId,scope.personId,scope.learnerPersonId]);if(result.rowCount!==1)throw new PaymentProofError('PROOF_NOT_FOUND');return result.rows[0];}
/** Internal-only receiving service. No file read/release, scanner bypass, receipt or public route. */
export async function submitPaymentProof(pool:Pool,grantId:string,raw:ProofSubmission,source:Buffer,configuration:ProofQuarantinePolicy,authorize:Authorize){
 const input=proofSubmission.parse(raw),policy=proofQuarantinePolicy.parse(configuration),scope=await scopeFor(grantId,authorize),file=quarantineFingerprint(source,input.mimeType);
 const digest=createHash('sha256').update(JSON.stringify({grantId:scope.grantId,claim:input.claim,mimeType:input.mimeType,fileHash:file.hash})).digest('hex');
 return financeTransaction(pool,async db=>{
  const account=await accountFor(db,scope,true),auditScope={schoolId:scope.schoolId,accountId:account.id,actorPersonId:scope.personId};
  const prior=(await db.query('SELECT proof_id,digest FROM school_finance.payment_proof_requests WHERE account_id=$1 AND actor_person_id=$2 AND request_id=$3',[account.id,scope.personId,input.requestId])).rows[0];
  if(prior){if(prior.digest!==digest)throw new PaymentProofError('PROOF_REQUEST_CONFLICT');const result=await summary(db,prior.proof_id,account.id,scope);sameScope(scope,await authorize(grantId));await financeAudit(db,auditScope,'FINANCE_FAMILY_PROOF_REPLAYED','PAYMENT_PROOF',prior.proof_id);return result;}
  if(input.claim.paidOn>account.today)throw new PaymentProofError('PROOF_FUTURE_DATE');
  const quota=(await db.query("SELECT count(*)::int AS n FROM school_finance.payment_proof_requests WHERE account_id=$1 AND actor_person_id=$2 AND created_at>now()-interval '24 hours'",[account.id,scope.personId])).rows[0];if(quota.n>=policy.requestsPerPersonDay)throw new PaymentProofError('PROOF_DAILY_LIMIT');
  const duplicate=(await db.query('SELECT id,digest FROM school_finance.payment_proof_cases WHERE account_id=$1 AND actor_person_id=$2 AND learner_person_id=$3 AND file_hash=$4',[account.id,scope.personId,scope.learnerPersonId,file.hash])).rows[0];
  const id:string=duplicate?.id??randomUUID();
  if(duplicate&&duplicate.digest!==digest)throw new PaymentProofError('PROOF_DUPLICATE_DETAILS_CHANGED');
  if(!duplicate){
   const used=(await db.query("SELECT COALESCE(SUM(file_size),0)::text AS bytes FROM school_finance.payment_proof_cases WHERE account_id=$1 AND received_at>now()-interval '24 hours'",[account.id])).rows[0];if(BigInt(used.bytes)+BigInt(file.size)>BigInt(policy.accountBytesPerDay))throw new PaymentProofError('PROOF_SCHOOL_DAILY_LIMIT');
   const inserted=await db.query(`INSERT INTO school_finance.payment_proof_cases(id,account_id,learner_person_id,actor_person_id,grant_id,digest,file_hash,mime_type,file_size,amount_minor,paid_on,payment_reference,method,policy_version,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now()+($15::integer*interval '1 hour')) RETURNING expires_at`,[id,account.id,scope.learnerPersonId,scope.personId,scope.grantId,digest,file.hash,input.mimeType,file.size,input.claim.amountMinor,input.claim.paidOn,input.claim.reference,input.claim.method,policy.version,policy.hours]);
   await db.query('INSERT INTO school_finance.payment_proof_quarantine(proof_id,account_id,body,expires_at) VALUES($1,$2,$3,$4)',[id,account.id,file.bytes,inserted.rows[0].expires_at]);
  }
  await db.query('INSERT INTO school_finance.payment_proof_requests(account_id,actor_person_id,request_id,proof_id,digest) VALUES($1,$2,$3,$4,$5)',[account.id,scope.personId,input.requestId,id,digest]);
  const result=await summary(db,id,account.id,scope);sameScope(scope,await authorize(grantId));
  await financeAudit(db,auditScope,duplicate?'FINANCE_FAMILY_PROOF_REPLAYED':'FINANCE_FAMILY_PROOF_QUARANTINED','PAYMENT_PROOF',id);
  return result;
 });
}
export async function paymentProofStatus(pool:Pool,grantId:string,requestId:string,authorize:Authorize){
 const request=z.string().uuid().toLowerCase().parse(requestId),scope=await scopeFor(grantId,authorize);
 return financeTransaction(pool,async db=>{const account=await accountFor(db,scope,false);const result=await db.query(`${summarySql} JOIN school_finance.payment_proof_requests r ON r.proof_id=p.id AND r.account_id=p.account_id AND r.actor_person_id=p.actor_person_id WHERE p.account_id=$1 AND p.actor_person_id=$2 AND p.learner_person_id=$3 AND r.request_id=$4`,[account.id,scope.personId,scope.learnerPersonId,request]);sameScope(scope,await authorize(grantId));if(result.rows[0])await financeAudit(db,{schoolId:scope.schoolId,accountId:account.id,actorPersonId:scope.personId},'FINANCE_FAMILY_PROOF_STATUS_READ','PAYMENT_PROOF',result.rows[0].id);return result.rows[0]?{found:true as const,proof:result.rows[0]}:{found:false as const};});
}
/** Dedicated scheduled cleanup connection only; normal web runtime has no DELETE or raw SELECT. */
export async function purgeExpiredPaymentProofFiles(pool:Pool){return financeTransaction(pool,async db=>{const result=await db.query(`WITH removed AS (DELETE FROM school_finance.payment_proof_quarantine WHERE proof_id IN (SELECT proof_id FROM school_finance.payment_proof_quarantine WHERE expires_at<=now() ORDER BY expires_at,proof_id LIMIT 100) AND expires_at<=now() RETURNING proof_id,account_id), recorded AS (INSERT INTO school_finance.payment_proof_purges(proof_id,account_id) SELECT proof_id,account_id FROM removed RETURNING proof_id) SELECT count(*)::int AS purged FROM recorded`);return {purged:result.rows[0].purged as number};});}
