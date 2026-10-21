import type {Pool} from "pg";
import {SupportError,type SupportContext} from "../support/contracts";
export async function observerQueue(pool:Pool,c:SupportContext,schoolId?:string,offset=0){
 const schools=c.observerSchools??[];
 if(!schools.length)throw new SupportError("OBSERVER_REQUIRED");
 if(schoolId&&!schools.some(s=>s.id===schoolId))throw new SupportError("OBSERVER_SCHOOL_REQUIRED");
 const db=await pool.connect();try{
 await db.query("BEGIN");
 // Deliberately exclude all narratives, names, requester identifiers and ticket detail URLs.
 const r=await db.query(`SELECT reference,school_id AS "schoolId",category,impact,area,status,priority,created_at AS "createdAt",updated_at AS "updatedAt" FROM support.tickets WHERE school_id=ANY($1::text[]) AND ($2::text IS NULL OR school_id=$2) AND status NOT IN ('RESOLVED','CLOSED') ORDER BY CASE priority WHEN 'URGENT' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'NORMAL' THEN 2 ELSE 3 END,created_at,id LIMIT 51 OFFSET $3`,[schools.map(s=>s.id),schoolId??null,offset]);
 await db.query(`INSERT INTO audit.product_audit_events(id,actor_person_id,action,resource_type,resource_id,school_id,decision,reason,metadata,occurred_at) VALUES(gen_random_uuid(),$1,'support.observer.queue.read','OPERATIONS_QUEUE',$1,$2,'ALLOW','current_scoped_peos_observer','{}'::jsonb,clock_timestamp())`,[c.personId,schoolId??""]);
 await db.query("COMMIT");return {personId:c.personId,schools,tickets:r.rows.slice(0,50),nextOffset:r.rows.length>50?offset+50:null,readOnly:true,asOf:new Date().toISOString()};
 }catch(e){await db.query("ROLLBACK");throw e;}finally{db.release();}
}
