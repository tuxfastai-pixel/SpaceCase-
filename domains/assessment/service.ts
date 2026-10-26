import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {AssessmentError,rubricSchema,validateScores,validateProposal,type AssessmentInput,type AssessmentAction,type Rubric,type ReviewScores} from "./contracts";
import type {PhotoStore,NormalizedPhoto} from "../../platform/assessment/storage";
import {exactPages,readingResultSchema,type ReadingReview} from "../../contracts/assessmentVision";
import type {AssessmentAi} from "../../platform/assessment/ai";
export type AssessmentScope={actor:string;school:string;classId:string;learnerIds:string[]};
function canonical(v:unknown):unknown{if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==="object")return Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,value])=>[k,canonical(value)]));return v;}
const digest=(v:unknown)=>createHash("sha256").update(JSON.stringify(canonical(v))).digest("hex");
export async function audit(db:PoolClient,s:AssessmentScope,id:string,action:string,metadata:unknown={}){
 await db.query(`INSERT INTO audit.product_audit_events(id,actor_person_id,action,resource_type,resource_id,school_id,decision,reason,metadata,occurred_at)
 VALUES(gen_random_uuid(),$1,$2,'ASSESSMENT',$3,$4,'ALLOW','current_peos_class_teacher',$5::jsonb,now())`,[s.actor,action,id,s.school,JSON.stringify(metadata)]);
}
async function workspace(db:PoolClient,s:AssessmentScope){
 const r=await db.query(`SELECT 1 FROM school_ops.school_workspaces w JOIN school_ops.class_workspaces c ON c.peos_school_id=w.peos_school_id WHERE w.peos_school_id=$1 AND c.peos_class_id=$2 AND w.status='ACTIVE' AND c.status='ACTIVE' FOR SHARE OF w,c`,[s.school,s.classId]);
 if(!r.rowCount)throw new AssessmentError("CLASS_WORKSPACE_REQUIRED",409);
}
export async function assessment(db:PoolClient,s:AssessmentScope,id:string){
 const r=await db.query(`SELECT * FROM assessment.assessments WHERE id=$1 AND teacher_person_id=$2 AND peos_school_id=$3 AND peos_class_id=$4 FOR UPDATE`,[id,s.actor,s.school,s.classId]);
 if(!r.rowCount)throw new AssessmentError("ASSESSMENT_UNAVAILABLE",404);return r.rows[0] as {id:string;status:string;revision:number;rubric:Rubric;instructions:string;title:string;subject:string};
}
export async function transaction<T>(pool:Pool,s:AssessmentScope,fn:(db:PoolClient)=>Promise<T>){const db=await pool.connect();try{await db.query("BEGIN");await workspace(db,s);const result=await fn(db);await db.query("COMMIT");return result;}catch(e){await db.query("ROLLBACK");throw e;}finally{db.release();}}
function learner(s:AssessmentScope,id:string){if(!s.learnerIds.includes(id))throw new AssessmentError("LEARNER_ACCESS_REQUIRED");}
async function submission(db:PoolClient,s:AssessmentScope,assessmentId:string,id:string){
 const r=await db.query("SELECT * FROM assessment.submissions WHERE id=$1 AND assessment_id=$2 FOR UPDATE",[id,assessmentId]);
 if(!r.rowCount)throw new AssessmentError("SUBMISSION_UNAVAILABLE",404);learner(s,r.rows[0].learner_person_id);return r.rows[0];
}
function revision(sub:{revision:number},value:number){if(sub.revision!==value)throw new AssessmentError("WORK_CHANGED",409);}
function editable(sub:{current_result_id:string|null}){if(sub.current_result_id)throw new AssessmentError("RESULT_APPROVED",409);}
async function invalidate(db:PoolClient,id:string){await db.query("UPDATE assessment.submissions SET revision=revision+1,matching_confirmed=false,reading=NULL,reading_review=NULL,proposal=NULL,review_scores=NULL,updated_at=now() WHERE id=$1",[id]);}
async function pages(db:PoolClient,id:string){const r=await db.query("SELECT id,object_key,page_number,content_hash FROM assessment.pages WHERE submission_id=$1 AND removed_at IS NULL AND upload_complete ORDER BY page_number,id",[id]);return r.rows as Array<{id:string;object_key:string;page_number:number;content_hash:string}>;}
async function confirmedPages(db:PoolClient,sub:{id:string;matching_confirmed:boolean}){const p=await pages(db,sub.id);if(!sub.matching_confirmed||p.length===0||p.some((v,i)=>v.page_number!==i+1))throw new AssessmentError("CONFIRM_PAGES_REQUIRED",409);return p;}
export async function createAssessment(pool:Pool,s:AssessmentScope,input:AssessmentInput){return transaction(pool,s,async db=>{
 await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[input.id]);
 const old=await db.query("SELECT * FROM assessment.assessments WHERE id=$1",[input.id]);
 if(old.rowCount){const r=old.rows[0];if(r.teacher_person_id!==s.actor||r.peos_school_id!==s.school||r.peos_class_id!==s.classId||r.title!==input.title||r.subject!==input.subject||r.instructions!==input.instructions||digest(r.rubric)!==digest(input.rubric))throw new AssessmentError("REQUEST_CONFLICT",409);return {id:r.id};}
 await db.query(`INSERT INTO assessment.assessments(id,teacher_person_id,peos_school_id,peos_class_id,title,subject,instructions,rubric) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,[input.id,s.actor,s.school,s.classId,input.title,input.subject,input.instructions,JSON.stringify(input.rubric)]);
 await audit(db,s,input.id,"assessment.create",{questions:input.rubric.length});return {id:input.id};
});}
export async function listAssessments(pool:Pool,s:AssessmentScope,offset:number){return transaction(pool,s,async db=>{
 const r=await db.query(`SELECT id,title,subject,status,created_at AS "createdAt" FROM assessment.assessments WHERE teacher_person_id=$1 AND peos_school_id=$2 AND peos_class_id=$3 ORDER BY created_at DESC,id LIMIT 51 OFFSET $4`,[s.actor,s.school,s.classId,offset]);
 return {assessments:r.rows.slice(0,50),nextOffset:r.rows.length>50?offset+50:null};
});}
export async function readAssessment(pool:Pool,s:AssessmentScope,id:string){return transaction(pool,s,async db=>{
 const a=await assessment(db,s,id);
 const p=await db.query(`SELECT p.id,p.submission_id AS "submissionId",p.page_number AS "pageNumber",p.byte_size AS "byteSize",p.revision,p.quality FROM assessment.pages p LEFT JOIN assessment.submissions s ON s.id=p.submission_id WHERE p.assessment_id=$1 AND p.removed_at IS NULL AND p.upload_complete AND (p.submission_id IS NULL OR s.learner_person_id=ANY($2::text[])) ORDER BY p.created_at,p.id`,[id,s.learnerIds]);
 const subs=await db.query(`SELECT s.id,s.learner_person_id AS "learnerId",s.revision,s.matching_confirmed AS "matchingConfirmed",s.reading,s.reading_review AS "readingReview",s.proposal,s.review_scores AS "reviewScores",s.current_result_id AS "currentResultId",r.total,r.maximum,r.approved_at AS "approvedAt" FROM assessment.submissions s LEFT JOIN assessment.results r ON r.id=s.current_result_id WHERE s.assessment_id=$1 AND s.learner_person_id=ANY($2::text[]) ORDER BY s.id`,[id,s.learnerIds]);
 await audit(db,s,id,"assessment.read",{pages:p.rowCount,submissions:subs.rowCount});return {assessment:{id:a.id,title:a.title,subject:a.subject,instructions:a.instructions,rubric:a.rubric,status:a.status,revision:a.revision},pages:p.rows,submissions:subs.rows};
});}
export async function uploadPage(pool:Pool,s:AssessmentScope,id:string,pageId:string,photo:NormalizedPhoto,store:PhotoStore){
 const reserved=await transaction(pool,s,async db=>{
  const a=await assessment(db,s,id);if(a.status!=="OPEN")throw new AssessmentError("OPEN_ASSESSMENT_REQUIRED",409);
  const old=await db.query("SELECT * FROM assessment.pages WHERE assessment_id=$1 AND (id=$2 OR (content_hash=$3 AND removed_at IS NULL))",[id,pageId,photo.hash]);
  if(old.rowCount){const found=old.rows.find(p=>p.id===pageId)??old.rows[0];if(found.removed_at||found.content_hash!==photo.hash)throw new AssessmentError("REQUEST_CONFLICT",409);return {id:found.id as string,key:found.object_key as string,complete:found.upload_complete as boolean};}
  const count=await db.query("SELECT count(*)::int AS n FROM assessment.pages WHERE assessment_id=$1 AND removed_at IS NULL",[id]);if(count.rows[0].n>=500)throw new AssessmentError("PAGE_LIMIT",409);
  const key=`assessment/${id}/${pageId}-${photo.hash}.jpg`;
  await db.query("INSERT INTO assessment.pages(id,assessment_id,object_key,content_hash,byte_size,quality) VALUES($1,$2,$3,$4,$5,$6::jsonb)",[pageId,id,key,photo.hash,photo.bytes.length,photo.quality?JSON.stringify(photo.quality):null]);
  return {id:pageId,key,complete:false};
 });
 if(reserved.complete)return {id:reserved.id,duplicate:true};
 // The durable reservation tracks interrupted objects; retries reuse the same immutable content key.
 await store.put(reserved.key,photo.bytes);
 return transaction(pool,s,async db=>{
  await assessment(db,s,id);
  const saved=await db.query("UPDATE assessment.pages SET upload_complete=true WHERE id=$1 AND assessment_id=$2 AND removed_at IS NULL AND NOT upload_complete RETURNING id",[reserved.id,id]);
  if(saved.rowCount)await audit(db,s,id,"assessment.photo.upload",{pageId:reserved.id,bytes:photo.bytes.length});
  const current=await db.query("SELECT upload_complete,removed_at FROM assessment.pages WHERE id=$1 AND assessment_id=$2",[reserved.id,id]);
  if(!current.rows[0]?.upload_complete||current.rows[0].removed_at)throw new AssessmentError("PHOTO_UNAVAILABLE",404);
  return {id:reserved.id,duplicate:!saved.rowCount};
 });
}
export async function readPhoto(pool:Pool,s:AssessmentScope,id:string,pageId:string,store:PhotoStore){
 const key=await transaction(pool,s,async db=>{await assessment(db,s,id);const r=await db.query(`SELECT p.object_key FROM assessment.pages p LEFT JOIN assessment.submissions s ON s.id=p.submission_id WHERE p.id=$1 AND p.assessment_id=$2 AND p.removed_at IS NULL AND p.upload_complete AND (p.submission_id IS NULL OR s.learner_person_id=ANY($3::text[]))`,[pageId,id,s.learnerIds]);if(!r.rowCount)throw new AssessmentError("PHOTO_UNAVAILABLE",404);await audit(db,s,id,"assessment.photo.read",{pageId});return r.rows[0].object_key as string;});
 return store.get(key);
}
export async function mutateAssessment(pool:Pool,s:AssessmentScope,id:string,input:Exclude<AssessmentAction,{action:"ASSIST"|"READ_WORK"}>){return transaction(pool,s,async db=>{
 const a=await assessment(db,s,id);
 if(input.action==="EDIT"){
  if(a.status!=="DRAFT")throw new AssessmentError("RUBRIC_LOCKED",409);revision(a,input.revision);
  if(input.definition.id!==id)throw new AssessmentError("INVALID_INPUT",400);
  const v=input.definition;await db.query("UPDATE assessment.assessments SET title=$2,subject=$3,instructions=$4,rubric=$5::jsonb,revision=revision+1 WHERE id=$1",[id,v.title,v.subject,v.instructions,JSON.stringify(v.rubric)]);
  await audit(db,s,id,"assessment.edit",{revision:input.revision});return {saved:true};
 }
 if(input.action==="OPEN"){if(!rubricSchema.safeParse(a.rubric).success)throw new AssessmentError("RUBRIC_REQUIRED",409);if(a.status!=="OPEN"){revision(a,input.revision);await db.query("UPDATE assessment.assessments SET status='OPEN',revision=revision+1 WHERE id=$1",[id]);await audit(db,s,id,"assessment.open");}return {saved:true};}
 if(a.status!=="OPEN")throw new AssessmentError("OPEN_ASSESSMENT_REQUIRED",409);
 if(input.action==="MATCH"||input.action==="REMOVE_PAGE"){
  const r=await db.query("SELECT * FROM assessment.pages WHERE id=$1 AND assessment_id=$2 AND removed_at IS NULL AND upload_complete FOR UPDATE",[input.pageId,id]);if(!r.rowCount)throw new AssessmentError("PHOTO_UNAVAILABLE",404);const page=r.rows[0];revision(page,input.revision);
  if(page.submission_id){const source=await submission(db,s,id,page.submission_id);editable(source);}
  if(input.action==="REMOVE_PAGE"){
   await db.query("UPDATE assessment.pages SET removed_at=now(),revision=revision+1 WHERE id=$1",[page.id]);if(page.submission_id)await invalidate(db,page.submission_id);
  }else{
   learner(s,input.learnerId);
   const target=await db.query(`INSERT INTO assessment.submissions(assessment_id,learner_person_id) VALUES($1,$2) ON CONFLICT(assessment_id,learner_person_id) DO NOTHING`,[id,input.learnerId]);void target;
   const tr=await db.query("SELECT * FROM assessment.submissions WHERE assessment_id=$1 AND learner_person_id=$2 FOR UPDATE",[id,input.learnerId]);const sub=tr.rows[0];editable(sub);
   if(page.submission_id===sub.id&&page.page_number===input.pageNumber)return {saved:true};
   const conflict=await db.query("SELECT id FROM assessment.pages WHERE submission_id=$1 AND page_number=$2 AND removed_at IS NULL AND id<>$3",[sub.id,input.pageNumber,page.id]);if(conflict.rowCount)throw new AssessmentError("PAGE_NUMBER_TAKEN",409);
   await db.query("UPDATE assessment.pages SET submission_id=$2,page_number=$3,revision=revision+1 WHERE id=$1",[page.id,sub.id,input.pageNumber]);await invalidate(db,sub.id);if(page.submission_id&&page.submission_id!==sub.id)await invalidate(db,page.submission_id);
  }
  await audit(db,s,id,`assessment.photo.${input.action.toLowerCase()}`,{pageId:page.id});return {saved:true};
 }
 const sub=await submission(db,s,id,input.submissionId);
 if(input.action==="APPROVE"&&sub.current_result_id){const old=await db.query("SELECT source_revision FROM assessment.results WHERE id=$1",[sub.current_result_id]);if(old.rows[0]?.source_revision===input.revision)return {saved:true,resultId:sub.current_result_id};}
 revision(sub,input.revision);
 if(input.action==="REOPEN"){
  if(!sub.current_result_id)throw new AssessmentError("RESULT_NOT_APPROVED",409);
  await db.query("INSERT INTO assessment.result_events(submission_id,result_id,actor_person_id,reason) VALUES($1,$2,$3,$4)",[sub.id,sub.current_result_id,s.actor,input.reason]);
  await db.query("UPDATE assessment.submissions SET current_result_id=NULL WHERE id=$1",[sub.id]);await invalidate(db,sub.id);
  await audit(db,s,id,"assessment.result.reopen",{submissionId:sub.id,reasonHash:digest(input.reason)});return {saved:true};
 }
 editable(sub);
 if(input.action==="CONFIRM_PAGES"){
  const p=await pages(db,sub.id);if(p.length===0||p.some((v,i)=>v.page_number!==i+1))throw new AssessmentError("PAGE_SEQUENCE_REQUIRED",409);
  await db.query("UPDATE assessment.submissions SET matching_confirmed=true,revision=revision+1,updated_at=now() WHERE id=$1",[sub.id]);
 }else if(input.action==="SAVE_READING"){
  const p=await confirmedPages(db,sub);if(!sub.reading||!exactPages(p.map(v=>v.id),input.pages))throw new AssessmentError("READING_REVIEW_REQUIRED",409);
  if(sub.review_scores)throw new AssessmentError("REVIEW_ALREADY_SAVED",409);
  await db.query("UPDATE assessment.submissions SET reading_review=$2::jsonb,proposal=NULL,revision=revision+1,updated_at=now() WHERE id=$1",[sub.id,JSON.stringify(input.pages)]);
 }else if(input.action==="SAVE_REVIEW"){
  await confirmedPages(db,sub);validateScores(a.rubric,input.scores);
  await db.query("UPDATE assessment.submissions SET review_scores=$2::jsonb,revision=revision+1,updated_at=now() WHERE id=$1",[sub.id,JSON.stringify(input.scores)]);
 }else if(input.action==="APPROVE"){
  await confirmedPages(db,sub);if(!sub.review_scores)throw new AssessmentError("REVIEW_REQUIRED",409);
  const total=validateScores(a.rubric,sub.review_scores as ReviewScores);const maximum=a.rubric.reduce((n,q)=>n+q.maxMarks,0);
  const r=await db.query("INSERT INTO assessment.results(submission_id,teacher_person_id,source_revision,scores,total,maximum) VALUES($1,$2,$3,$4::jsonb,$5,$6) RETURNING id",[sub.id,s.actor,input.revision,JSON.stringify(sub.review_scores),total,maximum]);
  await db.query("UPDATE assessment.submissions SET current_result_id=$2,revision=revision+1,updated_at=now() WHERE id=$1",[sub.id,r.rows[0].id]);
 }
 await audit(db,s,id,`assessment.${input.action.toLowerCase()}`,{submissionId:sub.id,revision:input.revision});return {saved:true};
});}
export async function assistAssessment(pool:Pool,s:AssessmentScope,id:string,input:Extract<AssessmentAction,{action:"ASSIST"|"READ_WORK"}>,store:PhotoStore,ai:AssessmentAi,reauthorize:()=>Promise<AssessmentScope>){
 const mode=input.action==="READ_WORK"?"READ":"MARK";
 const pending=await transaction(pool,s,async db=>{
  const a=await assessment(db,s,id);const sub=await submission(db,s,id,input.submissionId);
  const old=await db.query("SELECT * FROM assessment.ai_runs WHERE id=$1",[input.requestId]);
  if(old.rowCount){const run=old.rows[0];if(run.submission_id!==sub.id||run.actor_person_id!==s.actor||run.source_revision!==input.revision||run.purpose!==mode)throw new AssessmentError("REQUEST_CONFLICT",409);return {existing:run.status as string};}
  editable(sub);revision(sub,input.revision);if(sub.review_scores)throw new AssessmentError("REVIEW_ALREADY_SAVED",409);const p=await confirmedPages(db,sub);
  if(mode==="MARK"&&(!sub.reading_review||!exactPages(p.map(v=>v.id),sub.reading_review)))throw new AssessmentError("READING_REVIEW_REQUIRED",409);
  if(mode==="READ"&&sub.reading_review)throw new AssessmentError("READING_ALREADY_REVIEWED",409);
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`assessment-ai:${s.actor}`]);
  const counts=await db.query("SELECT count(*)::int AS n FROM assessment.ai_runs WHERE actor_person_id=$1 AND created_at>now()-interval '1 hour'",[s.actor]);if(counts.rows[0].n>=20)throw new AssessmentError("AI_RATE_LIMIT",429);
  const running=await db.query("SELECT 1 FROM assessment.ai_runs WHERE submission_id=$1 AND status='RUNNING' AND created_at>now()-interval '2 minutes'",[sub.id]);if(running.rowCount)throw new AssessmentError("AI_RUNNING",409);
  const hash=digest({rubric:a.rubric,instructions:a.instructions,pages:p.map(v=>[v.id,v.content_hash,v.page_number]),revision:sub.revision,mode,reviewedReadings:mode==="MARK"?sub.reading_review:null});
  await db.query("INSERT INTO assessment.ai_runs(id,submission_id,actor_person_id,source_revision,input_hash,status,purpose) VALUES($1,$2,$3,$4,$5,'RUNNING',$6)",[input.requestId,sub.id,s.actor,input.revision,hash,mode]);
  await audit(db,s,id,"assessment.assist.start",{runId:input.requestId,submissionId:sub.id,sourceRevision:sub.revision,pageCount:p.length});return {a,p,hash,reviewedReadings:sub.reading_review as ReadingReview|null};
 });
 if("existing" in pending)return {status:pending.existing};
 try{
  const images=await Promise.all(pending.p.map(async p=>({id:p.id,pageNumber:p.page_number,bytes:await store.get(p.object_key)})));
  // Recheck authority after loading photos and before any external disclosure.
  const current=await reauthorize();if(current.actor!==s.actor||current.school!==s.school||current.classId!==s.classId)throw new AssessmentError("CLASS_ACCESS_REQUIRED");
  const subCheck=await transaction(pool,current,db=>submission(db,current,id,input.submissionId));revision(subCheck,input.revision);editable(subCheck);
  const request={requestId:input.requestId,actorPersonId:s.actor,schoolId:s.school,assessmentId:id,submissionId:input.submissionId,sourceRevision:input.revision,inputHash:pending.hash,instructions:pending.a.instructions,rubric:pending.a.rubric,pages:images,reviewedReadings:pending.reviewedReadings??[]};
  const result=mode==="READ"?readingResultSchema.parse(await ai.read(request)):validateProposal(pending.a.rubric,pending.p.map(p=>p.id),await ai.propose(request));
  if(mode==="READ"&&(!("pages" in result)||!exactPages(pending.p.map(p=>p.id),result.pages)))throw new AssessmentError("INVALID_AI_RESPONSE",502);
  if(mode==="MARK"&&"items" in result){const uncertain=new Set((pending.reviewedReadings??[]).filter(p=>p.uncertain).map(p=>p.pageId));if(result.items.some(i=>i.evidencePageIds.some(p=>uncertain.has(p))&&(!i.uncertain||i.marks!==null)))throw new AssessmentError("INVALID_AI_RESPONSE",502);}
  const refreshed=await reauthorize();if(refreshed.actor!==s.actor||refreshed.school!==s.school||refreshed.classId!==s.classId)throw new AssessmentError("CLASS_ACCESS_REQUIRED");
  return await transaction(pool,refreshed,async db=>{
   await assessment(db,refreshed,id);const sub=await submission(db,refreshed,id,input.submissionId);
   if(sub.revision!==input.revision||sub.current_result_id||!sub.matching_confirmed){await db.query("UPDATE assessment.ai_runs SET status='STALE',finished_at=now() WHERE id=$1",[input.requestId]);return {status:"STALE"};}
   if(mode==="READ")await db.query("UPDATE assessment.submissions SET reading=$2::jsonb,reading_review=NULL,proposal=NULL,revision=revision+1,updated_at=now() WHERE id=$1",[sub.id,JSON.stringify(result)]);
   else await db.query("UPDATE assessment.submissions SET proposal=$2::jsonb,review_scores=NULL,revision=revision+1,updated_at=now() WHERE id=$1",[sub.id,JSON.stringify(result)]);
   await db.query("UPDATE assessment.ai_runs SET status='COMPLETED',execution_id=$2,model_ref=$3,policy_version=$4,finished_at=now() WHERE id=$1",[input.requestId,result.executionId,result.modelRef,result.policyVersion]);
   await audit(db,refreshed,id,"assessment.assist.complete",{runId:input.requestId,executionId:result.executionId,modelRef:result.modelRef,policyVersion:result.policyVersion});return {status:"COMPLETED"};
  });
 }catch(e){await pool.query("UPDATE assessment.ai_runs SET status='FAILED',finished_at=now() WHERE id=$1 AND status='RUNNING'",[input.requestId]);throw e;}
}
