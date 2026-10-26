import type {Pool} from 'pg';
import {createHash} from 'node:crypto';
import {assessment,transaction,audit,type AssessmentScope} from './service';
import {AssessmentError} from './contracts';
import {sourceTextInput,SOURCE_LIMIT,SOURCE_BYTES,SOURCE_TOTAL_BYTES,type SourceKind,type SourceFormat} from './sourceContracts';
import type {SourceStore} from '../../platform/assessment/sourceStore';
const fields='id,kind,format,byte_size AS "byteSize",revision,transcript,transcript_reviewed AS "transcriptReviewed"';
export async function listSources(pool:Pool,s:AssessmentScope,id:string){return transaction(pool,s,async db=>{await assessment(db,s,id);const r=await db.query(`SELECT ${fields} FROM assessment.source_materials WHERE assessment_id=$1 AND upload_complete AND removed_at IS NULL ORDER BY created_at,id LIMIT 20`,[id]);await audit(db,s,id,'assessment.sources.list');return {sources:r.rows};});}
export async function uploadSource(pool:Pool,s:AssessmentScope,id:string,assetId:string,kind:SourceKind,format:SourceFormat,file:{bytes:Buffer;hash:string},store:SourceStore,recheck:()=>Promise<AssessmentScope>){
 if(!file.bytes.length||file.bytes.length>SOURCE_BYTES||createHash('sha256').update(file.bytes).digest('hex')!==file.hash)throw new AssessmentError('INVALID_SOURCE_DOCUMENT',400);
 const reservation=await transaction(pool,s,async db=>{
  await assessment(db,s,id);
  const old=await db.query('SELECT * FROM assessment.source_materials WHERE id=$1 OR (assessment_id=$2 AND content_hash=$3 AND kind=$4)',[assetId,id,file.hash,kind]);
  if(old.rowCount){const a=old.rows.find(r=>r.id===assetId)??old.rows[0];if(a.assessment_id!==id||a.content_hash!==file.hash||a.kind!==kind||a.format!==format||a.removed_at)throw new AssessmentError('REQUEST_CONFLICT',409);return {id:a.id as string,key:a.object_key as string,complete:a.upload_complete as boolean};}
  const count=await db.query('SELECT count(*)::int AS n,COALESCE(sum(byte_size),0)::int AS bytes FROM assessment.source_materials WHERE assessment_id=$1',[id]);if(count.rows[0].n>=SOURCE_LIMIT||count.rows[0].bytes+file.bytes.length>SOURCE_TOTAL_BYTES)throw new AssessmentError('SOURCE_LIMIT',409);
  const key=`assessment-sources/${id}/${assetId}-${file.hash}`;
  await db.query('INSERT INTO assessment.source_materials(id,assessment_id,kind,format,object_key,content_hash,byte_size) VALUES($1,$2,$3,$4,$5,$6,$7)',[assetId,id,kind,format,key,file.hash,file.bytes.length]);return {id:assetId,key,complete:false};
 });
 if(reservation.complete)return {id:reservation.id,duplicate:true};await store.put(reservation.key,file.bytes);
 const fresh=await recheck();if(fresh.actor!==s.actor||fresh.school!==s.school||fresh.classId!==s.classId)throw new AssessmentError('ASSESSMENT_UNAVAILABLE',403);
 return transaction(pool,fresh,async db=>{await assessment(db,fresh,id);const r=await db.query('UPDATE assessment.source_materials SET upload_complete=true WHERE id=$1 AND assessment_id=$2 AND removed_at IS NULL AND NOT upload_complete RETURNING id',[reservation.id,id]);const current=await db.query('SELECT upload_complete,removed_at FROM assessment.source_materials WHERE id=$1 AND assessment_id=$2',[reservation.id,id]);if(!current.rows[0]?.upload_complete||current.rows[0].removed_at)throw new AssessmentError('SOURCE_UNAVAILABLE',404);if(r.rowCount)await audit(db,fresh,id,'assessment.source.upload',{sourceId:reservation.id,bytes:file.bytes.length,format,kind});return {id:reservation.id,duplicate:!r.rowCount};});
}
export async function readSource(pool:Pool,s:AssessmentScope,id:string,assetId:string,store:SourceStore){
 const record=await transaction(pool,s,async db=>{await assessment(db,s,id);const r=await db.query('SELECT object_key,format FROM assessment.source_materials WHERE id=$1 AND assessment_id=$2 AND upload_complete AND removed_at IS NULL',[assetId,id]);if(!r.rowCount)throw new AssessmentError('SOURCE_UNAVAILABLE',404);await audit(db,s,id,'assessment.source.read',{sourceId:assetId});return r.rows[0] as {object_key:string;format:SourceFormat};});
 return {bytes:await store.get(record.object_key),format:record.format};
}
export async function saveSourceText(pool:Pool,s:AssessmentScope,id:string,assetId:string,value:unknown){const input=sourceTextInput.parse(value);if(input.reviewed&&!input.text.trim())throw new AssessmentError('INVALID_INPUT',400);return transaction(pool,s,async db=>{await assessment(db,s,id);const r=await db.query('UPDATE assessment.source_materials SET transcript=$3,transcript_reviewed=$4,revision=revision+1 WHERE id=$1 AND assessment_id=$2 AND revision=$5 AND upload_complete AND removed_at IS NULL RETURNING revision',[assetId,id,input.text,input.reviewed,input.revision]);if(!r.rowCount)throw new AssessmentError('WORK_CHANGED',409);await audit(db,s,id,'assessment.source.text.save',{sourceId:assetId,reviewed:input.reviewed});return {revision:r.rows[0].revision};});}

export async function hideSource(pool:Pool,s:AssessmentScope,id:string,assetId:string,revision:number){return transaction(pool,s,async db=>{await assessment(db,s,id);const r=await db.query('UPDATE assessment.source_materials SET removed_at=now(),revision=revision+1 WHERE id=$1 AND assessment_id=$2 AND revision=$3 AND upload_complete AND removed_at IS NULL RETURNING id',[assetId,id,revision]);if(!r.rowCount)throw new AssessmentError('WORK_CHANGED',409);await audit(db,s,id,'assessment.source.hide',{sourceId:assetId});return {hidden:true};});}
